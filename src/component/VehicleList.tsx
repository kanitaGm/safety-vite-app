import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Container, Card, CardContent,    
  Pagination, Select, MenuItem, InputLabel, FormControl, Typography, Box, Link,
  Chip, Avatar, IconButton, Tooltip, CircularProgress, Alert, Skeleton,
  Paper, Fade, Zoom
} from "@mui/material";
import Grid2 from '@mui/material/Grid';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import HistoryIcon from '@mui/icons-material/History';
import ImageIcon from '@mui/icons-material/Image';
//import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface Vehicle {
  _id?: string;
  id: string;
  owner: string;
  ownerName: string;
  site: string;
  type: string;
}

interface Inspection {
  id: string;
  date: string;
  inspector: string;
  mileage: number | string | unknown;
  remark?: string;
  lat?: number;
  lng?: number;
  [key: string]: string | number | unknown;
}

const normalizeId = (id: string | undefined): string => (id ?? "").trim().toLowerCase();

function VehicleInspectionSummary() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [vehicleCol, setVehicleCol] = useState("daily");
  const [inspectionCol, setInspectionCol] = useState("ieco");
  const [typeParam, setTypeParam] = useState("car");
  const [selectParam, setSelectParam] = useState("7");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<Inspection[] | null>(null);
  const [showDefectStatus, setShowDefectStatus] = useState<"all" | "defect" | "normal" | "notChecked">("all");

  const [searchId, setSearchId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vRes, iRes] = await Promise.all([
        fetch(
          `https://ap-southeast-1.aws.data.mongodb-api.com/app/assetscp-gruyu/endpoint/showData?collection=${inspectionCol}_${vehicleCol}&type=${typeParam}`
        ),
        fetch(
          `https://ap-southeast-1.aws.data.mongodb-api.com/app/assetscp-gruyu/endpoint/showData?collection=${inspectionCol}_${typeParam}&type=${typeParam}&s=${selectParam}`
        ),
      ]);
      const [vData, iData] = await Promise.all([vRes.json(), iRes.json()]);

      setVehicles(vData);
      setInspections(iData);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [vehicleCol, inspectionCol, typeParam, selectParam]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


const { latestInspectionMap, groupedInspections } = useMemo(() => {
    const latestMap: Record<string, Inspection> = {};
    const grouped: Record<string, Inspection[]> = {};

    inspections.forEach((entry) => {
      const normId = normalizeId(entry.id);
      if (!normId) return;
      
      grouped[normId] = grouped[normId] || [];
      grouped[normId].push(entry);
      
      const currDate = new Date(entry.date).getTime();
      const prevDate = latestMap[normId]?.date
        ? new Date(latestMap[normId].date).getTime()
        : 0;
      
      if (!latestMap[normId] || currDate > prevDate) {
        latestMap[normId] = entry;
      }
    });

    return { latestInspectionMap: latestMap, groupedInspections: grouped };
  }, [inspections]);

    const vehicleMap = useMemo(() => {
    const map: Record<string, Vehicle> = {};
    vehicles.forEach((v) => (map[normalizeId(v.id)] = v));
    return map;
  }, [vehicles]);

  //const latestInspectionMap: Record<string, Inspection> = {};
  //const groupedInspections: Record<string, Inspection[]> = {};

  inspections.forEach((entry) => {
    const normId = normalizeId(entry.id);
    if (!normId) return;
    groupedInspections[normId] = groupedInspections[normId] || [];
    groupedInspections[normId].push(entry);
    const currDate = new Date(entry.date).getTime();
    const prevDate = latestInspectionMap[normId]?.date
      ? new Date(latestInspectionMap[normId].date).getTime()
      : 0;
    if (!latestInspectionMap[normId] || currDate > prevDate) {
      latestInspectionMap[normId] = entry;
    }
  });

  const isInspectionNotPass = useCallback((insp: Inspection | undefined): boolean => {
    if (!insp) return false;
    for (const [key, val] of Object.entries(insp)) {
      if (
        ![
          "id", "date", "inspector", "mileage", "remark", "lat", "lng",
          "_id", "type", "db", "collection",
        ].includes(key.toLowerCase())
      ) {
        if (val === undefined || val === null) continue;
        if (typeof val === "string") {
          const valLower = val.trim().toLowerCase();
          if (valLower !== "pass" && valLower !== "n/a" && valLower !== "") {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const getRemarkSummary = useCallback((insp?: Inspection): string => {
    if (!insp) return "-";
    const remarks = Object.entries(insp)
      .filter(([k]) => k === "remark" || k.endsWith("R"))
      .map(([, v]) => v)
      .filter(Boolean)
      .map(String)
      .join(" | ");
    return remarks || "-";
  }, []);

  const getImageUrls = useCallback((insp?: Inspection): string[] => {
    if (!insp) return [];
    return Object.entries(insp)
      .filter(([k, v]) => k.endsWith("P") && typeof v === "string" && v.startsWith("http"))
      .map(([, v]) => v as string);
  }, []);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Inspection Details");
    const baseFields = [
      { header: "ID", key: "id", width: 15 },
      { header: "Owner", key: "owner", width: 20 },
      { header: "วันที่ตรวจ", key: "date", width: 25 },
      { header: "ผู้ตรวจ", key: "inspector", width: 25 },
      { header: "Mileage", key: "mileage", width: 25 },
      { header: "Remark", key: "remark", width: 40 },
      { header: "Status", key: "status", width: 12 },
    ];
    const dynamicKeys = new Set<string>();
    inspections.forEach((insp) => {
      Object.keys(insp).forEach((k) => {
        const keyLower = k.toLowerCase();
        if (["id", "date", "inspector", "mileage", "remark", "lat", "lng", "_id", "type", "db", "collection"].includes(keyLower)) return;
        dynamicKeys.add(k);
      });
    });
    sheet.columns = [...baseFields, ...Array.from(dynamicKeys).map((k) => ({ header: k, key: k, width: 15 }))];
    inspections.forEach((insp) => {
      const v = vehicleMap[normalizeId(insp.id)];
      const status = isInspectionNotPass(insp) ? "Defect" : "Normal";
      const date = insp.date ? new Date(insp.date) : null;
      const dateStr = date ? `${date.toLocaleDateString()} ${date.toLocaleTimeString()}` : "";
      const row: Record<string, any> = {
        id: insp.id,
        owner: v?.owner ?? "-",
        date: dateStr,
        inspector: insp.inspector ?? "-",
        mileage: insp.mileage ?? "-",
        remark: insp.remark ?? "-",
        status,
      };
      dynamicKeys.forEach((k) => (row[k] = insp[k] ?? ""));
      sheet.addRow(row);
    });
    const buf = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `VehicleInspectionAll_${Date.now()}.xlsx`);
  };

  const filteredVehicles = useMemo(() => {
    const searchLower = searchId.trim().toLowerCase();
    return vehicles.filter((v) => {
      const normId = normalizeId(v.id);
      const latest = latestInspectionMap[normId];
      if (showDefectStatus === "notChecked" && latest) return false;
      if (showDefectStatus === "defect" && !isInspectionNotPass(latest)) return false;
      if (showDefectStatus === "normal" && (isInspectionNotPass(latest) || !latest)) return false;

      if (searchLower) {
        const values = [v.id, v.ownerName, v.owner, latest?.inspector].map(x => x?.toLowerCase() ?? "");
        const dateStr = latest?.date ? new Date(latest.date).toLocaleDateString("th-TH") : "";
        return [...values, dateStr].some((val) => val.includes(searchLower));
      }
      return true;
    });
  }, [vehicles, latestInspectionMap, searchId, showDefectStatus, isInspectionNotPass]);


  const totalPages = Math.ceil(filteredVehicles.length / rowsPerPage);
  const currentVehicles = useMemo(() => {
    return filteredVehicles.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage
    );
  }, [filteredVehicles, currentPage, rowsPerPage]);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  const handleRowsPerPageChange = (event: any) => {
    setRowsPerPage(Number(event.target.value));
    setCurrentPage(1);
  };

    // Memoized statistics
  const stats = useMemo(() => {
    const total = vehicles.length;
    let notChecked = 0, defect = 0;
    vehicles.forEach((v) => {
      const latest = latestInspectionMap[normalizeId(v.id)];
      if (!latest) notChecked++;
      else if (isInspectionNotPass(latest)) defect++;
    });
    return { total, notChecked, checked: total - notChecked, defect };
  }, [vehicles, latestInspectionMap, isInspectionNotPass]);

  const getStatusChip = (status: string) => {
    switch (status) {
      case "Normal":
        return (
          <Chip
            icon={<CheckCircleIcon />}
            label="Normal"
            color="success"
            variant="filled"
            size="small"
          />
        );
      case "Defect":
        return (
          <Chip
            icon={<ErrorIcon />}
            label="Defect"
            color="error"
            variant="filled"
            size="small"
          />
        );
      default:
        return (
          <Chip
            icon={<WarningIcon />}
            label="Not Inspected"
            color="warning"
            variant="filled"
            size="small"
          />
        );
    }
  };

  if (error) {
    return (
      <Container maxWidth={false} sx={{ my: 6, px: { xs: 2, md: 3 } }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={fetchData} startIcon={<RestartAltIcon />}>
          ลองใหม่อีกครั้ง
        </Button>
      </Container>
    );
  }



  {/**------------------UI----------------- */}
  return (        
    <Container maxWidth={false} sx={{ my: 3, px: { xs: 2, md: 3 }, pt: { xs: '2px', md: '2px' } }}>
    <Box>
          <Typography 
            variant="h4" 
            mb={3} 
            fontWeight="bold"
            sx={{
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textAlign: 'center',
              mb: 4
            }}
          > 🚗 Vehicle Inspection Dashboard 🚗
          </Typography>      

      {/* Enhanced Dashboard cards */}
          <Grid2 container spacing={3} mb={4} columns={{ xs: 12, sm: 12, md: 12 }}>
            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <Zoom in timeout={600}>
                <Card 
                  sx={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    textAlign: "center",
                    transition: 'transform 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                    }
                  }}
                >
                  <CardContent>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mx: 'auto', mb: 2 }}>
                      <DirectionsCarIcon />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>จำนวนทั้งหมด</Typography>
                    <Typography variant="h2" fontWeight="bold" sx={{ my: 1, color: 'white'}}>
                      {loading ? <CircularProgress size={40} color="inherit" /> : stats.total}
                    </Typography>
                    <Typography variant="body2" component="span" sx={{ opacity: 0.7 }}>
                      ในพื้นที่ {inspectionCol.toUpperCase()}
                    </Typography>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <Zoom in timeout={800}>
                <Card 
                  sx={{ 
                    background: 'linear-gradient(135deg, #fbc0f8 0%, #f5576c 100%)',
                    color: 'white',
                    textAlign: "center",
                    transition: 'transform 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                    }
                  }}
                >
                  <CardContent>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mx: 'auto', mb: 2 }}>
                      <WarningIcon />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>ยังไม่ตรวจสอบ</Typography>
                    <Typography variant="h2" fontWeight="bold"  sx={{ my: 1, color: 'white'}}>
                      {loading ? <CircularProgress size={40} color="inherit" /> : stats.notChecked}
                    </Typography>
                    <Typography variant="body2" component="span" sx={{ opacity: 0.7 }}>
                      ในรอบ {selectParam} วันล่าสุด
                    </Typography>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <Zoom in timeout={1000}>
                <Card 
                  sx={{ 
                    background: 'linear-gradient(135deg, #17c67f 0%, #00f2fe 100%)',
                    color: 'white',
                    textAlign: "center",
                    transition: 'transform 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                    }
                  }}
                >
                  <CardContent>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mx: 'auto', mb: 2 }}>
                      <CheckCircleIcon />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>ตรวจสอบแล้ว</Typography>
                    <Typography variant="h2" fontWeight="bold"  sx={{ my: 1, color: 'white'}}>
                      {loading ? <CircularProgress size={40} color="inherit" /> : stats.checked}
                    </Typography>
                    <Typography variant="body2" component="span" sx={{ opacity: 0.7 }}>
                      ในรอบ {selectParam} วันล่าสุด
                    </Typography>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid2>

            <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
              <Zoom in timeout={1200}>
                <Card 
                  sx={{ 
                    background: 'linear-gradient(135deg, #fa701a 0%, #fee1e0 100%)',
                    color: 'white',
                    textAlign: "center",
                    transition: 'transform 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.15)'
                    }
                  }}
                >
                  <CardContent>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mx: 'auto', mb: 2 }}>
                      <ErrorIcon />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>มีผลผิดปกติ</Typography>
                    <Typography variant="h2" fontWeight="bold"  sx={{ my: 1, color: 'red'}}>
                      {loading ? <CircularProgress size={40} color="inherit" /> : stats.defect}
                    </Typography>
                    <Typography variant="body2" component="span" sx={{ opacity: 0.7 }}>
                      ในรอบ {selectParam} วันล่าสุด
                    </Typography>
                  </CardContent>
                </Card>
              </Zoom>
            </Grid2>
          </Grid2>


      {/* Enhanced Controls >> Search and filter */}
          <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 3 }}>
            <Grid2 container spacing={2} mb={3} columns={{ xs: 12, sm: 12, md: 12 }} alignItems="center">
              <Grid2 size={{ xs: 12, sm: 3, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Type of Inspection</InputLabel>
                  <Select
                    value={vehicleCol}
                    label="Type of Inspection"
                    onChange={(e) => setVehicleCol(e.target.value)}
                  >
                    <MenuItem value="daily">🗓️ Daily</MenuItem>
                    <MenuItem value="monthly">📅 Monthly</MenuItem>
                    <MenuItem value="quaterly">📊 Quarterly</MenuItem>
                    <MenuItem value="annualy">📈 Annual</MenuItem>
                  </Select>
                </FormControl>
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 3, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Report Area</InputLabel>
                  <Select
                    value={inspectionCol}
                    label="Report Area"
                    onChange={(e) => setInspectionCol(e.target.value)}
                  >
                    <MenuItem value="ieco">🏢 IECO</MenuItem>
                    <MenuItem value="srb">🏭 SRB</MenuItem>
                    <MenuItem value="lbm">🏪 LBM</MenuItem>
                    <MenuItem value="rmx">🚛 RMX</MenuItem>
                    <MenuItem value="iagg">🏗️ IAGG</MenuItem>
                    <MenuItem value="office">🏢 OFFICE</MenuItem>
                    <MenuItem value="th">🇹🇭 TH-Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 3, md: 3 }}>
                <TextField
                  label="Vehicle Type"
                  variant="outlined"
                  fullWidth
                  value={typeParam}
                  onChange={(e) => setTypeParam(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: <DirectionsCarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }
                  }}
                />
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 3, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Days Show</InputLabel>
                  <Select
                    value={selectParam}
                    label="Days Show"
                    onChange={(e) => setSelectParam(e.target.value)}
                  >
                    <MenuItem value="7">📅 7 Days</MenuItem>
                    <MenuItem value="15">📅 15 Days</MenuItem>
                    <MenuItem value="30">📅 30 Days</MenuItem>
                    <MenuItem value="60">📅 60 Days</MenuItem>
                    <MenuItem value="120">📅 120 Days</MenuItem>
                    <MenuItem value="180">📅 180 Days</MenuItem>
                  </Select>
                </FormControl>
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 12, md: 3 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button 
                    variant="contained" 
                    onClick={fetchData} 
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RestartAltIcon />}
                    disabled={loading}
                    sx={{ 
                      background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                      minHeight: 50 
                    }}
                  >
                    Refresh
                  </Button>
                  <Button 
                    variant="contained" 
                    color="success" 
                    onClick={exportToExcel} 
                    startIcon={<FileDownloadIcon />}
                    sx={{ minHeight: 50 }}
                  >
                    Export
                  </Button>
                </Box>
              </Grid2>
            </Grid2>

            {/* Enhanced Search and Filter */}
            <Grid2 container spacing={2} alignItems="center">
              <Grid2 size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  label="Searching for Vehicle ID, Owner, Inspector or Date..."
                  variant="outlined"
                  fullWidth
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 6, md: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>สถานะตรวจสอบ</InputLabel>
                  <Select
                    value={showDefectStatus}
                    label="สถานะตรวจสอบ"
                    onChange={(e) => setShowDefectStatus(e.target.value as any)}
                  >
                    <MenuItem value="all">🔍 Show All</MenuItem>
                    <MenuItem value="notChecked">⚠️ Not-Inspected</MenuItem>
                    <MenuItem value="defect">❌ Defect</MenuItem>
                    <MenuItem value="normal">✅ Normal</MenuItem>
                  </Select>
                </FormControl>
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 6, md: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    📊 Total: {filteredVehicles.length} items
                  </Typography>
                </Box>
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    shape="rounded"
                    size="medium"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              </Grid2>

              <Grid2 size={{ xs: 12, sm: 6, md: 1 }}>
                <FormControl fullWidth size="small">
                  <Select
                    value={rowsPerPage}
                    onChange={handleRowsPerPageChange}
                    displayEmpty
                  >
                    {[25, 50, 75, 100].map((num) => (
                      <MenuItem key={num} value={num}>
                        {num} rows
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid2>
            </Grid2>
          </Paper>

      
      {/* Enhanced  Table */}
      {loading ? (
            <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Skeleton variant="text" height={60} />
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={80} />
                ))}
              </Box>
            </Paper>
      ) : (
        <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer sx={{maxHeight: 800 ,  borderRadius: 2, boxShadow: 1 }}>
          <Table stickyHeader size="small">
            <TableHead>
                    <TableRow>
                      {[
                        { label: "ID", align: "left" },
                        { label: "👤 Owner", align: "left" },
                        { label: "📅 Date", align: "left" },
                        { label: "🔍 Inspector", align: "left" },
                        { label: "🛣️ Mileage", align: "center" },
                        { label: "📝 Findings", align: "left" },
                        { label: "📷 Images", align: "center" },
                        { label: "📍 Location", align: "center" },
                        { label: "⚡ Status", align: "center" },
                        { label: "📋 History", align: "center" }
                      ].map((header, index) => (
                        <TableCell 
                          key={index}
                          align={header.align as any}
                          sx={{
                            fontWeight: "bold",
                            background: 'linear-gradient(135deg,#7f9f92 0%, #51bb90 100%)',
                            color: "white",
                            borderBottom: "none",
                            fontSize: '0.9rem'
                          }}
                        >
                          {header.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>

    <TableBody>
      {currentVehicles.map((v, i) => {
        const normId = normalizeId(v.id);
        const latest = latestInspectionMap[normId];
        const imageUrls = getImageUrls(latest);
        const statusText = !latest
          ? "Not-Inspected"
          : isInspectionNotPass(latest)
            ? "Defect"
            : "Normal";
                      return (
                        <TableRow
                          key={`${normId}-${i}`}
                          sx={{
                            bgcolor: !latest ? "rgba(255, 193, 7, 0.1)" : "inherit",
                            '&:hover': {
                              bgcolor: 'rgba(25, 118, 210, 0.08)',
                              transform: 'scale(1.001)',
                              transition: 'all 0.2s ease-in-out'
                            },
                            '&:nth-of-type(even)': {
                              bgcolor: 'rgba(0, 0, 0, 0.02)'
                            }
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.8rem' }}>
                                {v.id.slice(0, +3)}
                              </Avatar>
                              <Typography variant="body2" component="span" fontWeight="bold">
                                {v.id}
                              </Typography>
                            </Box>
                          </TableCell>

                          <TableCell>
                            <Box>
                              <Typography variant="body2" component="span" fontWeight="600">
                                {v.ownerName}
                              </Typography> <br/>
                              <Typography variant="caption" color="text.secondary">
                                {v.owner}
                              </Typography>
                            </Box>
                          </TableCell>

                          <TableCell >
                            <Box sx={{ display: 'flex',  gap: 1 }}>
                             
                              <Typography variant="body2" component="span">
                                {latest?.date
                                  ? new Date(latest.date).toLocaleDateString("th-TH", {
                                      day: '2-digit',
                                      month: 'long',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : <Chip label="N/A" variant="outlined" size="small" color="default" />}
                              </Typography>
                            </Box>
                          </TableCell>

                          <TableCell>
                            <Typography variant="body2" component="span">
                              {latest?.inspector ?? <Chip label="N/A" variant="outlined" size="small" color="default" />}
                            </Typography>
                          </TableCell>

                          <TableCell align="center">
                            <Chip
                              label={typeof latest?.mileage === "string" || typeof latest?.mileage === "number"
                                ? `${latest.mileage} km`
                                : "N/A"}
                              variant="outlined"
                              size="small"
                              color={latest?.mileage ? "primary" : "default"}
                            />
                          </TableCell>

                          <TableCell>
                            <Typography 
                              variant="body2" 
                              component="span"
                              sx={{ 
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {getRemarkSummary(latest)}
                            </Typography>
                          </TableCell>

                          <TableCell align="center">
                            {imageUrls.length > 0 ? (
                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                                {imageUrls.slice(0, 2).map((url, j) => (
                                  <Tooltip key={j} title="คลิกเพื่อดูภาพใหญ่">
                                    <Link
                                      href={url}
                                      target="_blank"
                                      rel="noopener"
                                      sx={{ display: 'inline-block' }}
                                    >
                                      <img
                                        src={url}
                                        alt={`img${j}`}
                                        style={{
                                          width: 40,
                                          height: 40,
                                          objectFit: "cover",
                                          borderRadius: 8,
                                          border: "2px solid #e0e0e0",
                                          transition: 'transform 0.2s ease',
                                          cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.transform = 'scale(1.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.transform = 'scale(1)';
                                        }}
                                      />
                                    </Link>
                                  </Tooltip>
                                ))}
                                {imageUrls.length > 2 && (
                                  <Chip
                                    label={`+${imageUrls.length - 2}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <ImageIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                              </Box>
                            )}
                          </TableCell>

                          <TableCell align="center">
                            {latest?.lat && latest?.lng ? (
                              <Tooltip title="ดูตำแหน่งใน Google Maps">
                                <IconButton
                                  component={Link}
                                  href={`https://www.google.com/maps?q=${latest.lat},${latest.lng}`}
                                  target="_blank"
                                  rel="noopener"
                                  color="primary"
                                  size="small"
                                >
                                  <LocationOnIcon />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <LocationOnIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                            )}
                          </TableCell>

                          <TableCell align="center">
                            {getStatusChip(statusText)}
                          </TableCell>

                          <TableCell align="center">
                            <Tooltip title="ดูประวัติการตรวจสอบ">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => setSelectedHistory(groupedInspections[normId] || [])}
                                sx={{
                                  '&:hover': {
                                    backgroundColor: 'primary.main',
                                    color: 'white',
                                    transform: 'scale(1.1)'
                                  },
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <HistoryIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}


      {/* Enhanced History Dialog ประวัติ */}
      <Dialog
        open={!!selectedHistory}
        onClose={() => setSelectedHistory(null)}
        maxWidth="lg"
        fullWidth       
      >
        <DialogTitle>ประวัติการตรวจย้อนหลัง {selectParam} วันล่าสุด</DialogTitle>
        <DialogContent dividers>
          {selectedHistory && (
            <Table size="small" aria-label="history table">
              <TableHead>
                <TableRow>
                  <TableCell align="center">วันที่</TableCell>
                  <TableCell align="center">Inspector</TableCell>
                  <TableCell>Remark / รูปภาพ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedHistory.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell align="center">
                      {r.date ? new Date(r.date).toLocaleString("th-TH") : "-"}
                    </TableCell>
                    <TableCell align="center">{r.inspector ?? "-"}</TableCell>
                    <TableCell>
                      {getRemarkSummary(r)}
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                        {getImageUrls(r).map((url, j) => (
                          <Link
                            key={j}
                            href={url}
                            target="_blank"
                            rel="noopener"
                            sx={{ display: "inline-block" }}
                          >
                            <img
                              src={url}
                              alt={`img${j}`}
                              style={{ width: 60, borderRadius: 4, border: "1px solid #ccc" }}
                            />
                          </Link>
                        ))}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedHistory(null)}>ปิด</Button>
        </DialogActions>
      </Dialog>
    </Box>
    </Container>

  );
}

export default VehicleInspectionSummary;
