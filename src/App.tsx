import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MapComponent from './MapComponent';
import { AlertTriangle, Send, Image as ImageIcon, Edit, Trash2, List, Plus, X } from 'lucide-react';
import exifr from 'exifr';
import './index.css';

export interface TrackingPoint {
  id: string;
  lat: number;
  lng: number;
  timestamp: string;
  description: string;
  notes?: string;
  type: string;
  mediaUrl: string | null;
  mediaType: string | null;
}

const API_URL = '/api/points';
const API_BASE_URL = '';

function App() {
  const [points, setPoints] = useState<TrackingPoint[]>([]);
  const [selectedLatLng, setSelectedLatLng] = useState<{lat: number, lng: number} | null>(null);
  const [isPinningMode, setIsPinningMode] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // UI States
  const [sheetOpen, setSheetOpen] = useState<'form' | 'list' | null>(null);

  // Form states
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [rawLocationInput, setRawLocationInput] = useState('');
  const [time, setTime] = useState(new Date().toISOString().substring(0, 16));
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPoints = async () => {
    try {
      const res = await axios.get(API_URL);
      // Sắp xếp các điểm theo thời gian tăng dần (Cũ nhất là #1)
      const sortedPoints = (res.data as TrackingPoint[]).sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        // Nếu không có thời gian hợp lệ, giữ nguyên vị trí
        if (isNaN(timeA) || isNaN(timeB)) return 0;
        return timeA - timeB;
      });
      setPoints(sortedPoints);
    } catch (err) {
      console.error('Error fetching points', err);
    }
  };

  useEffect(() => {
    fetchPoints();
    const interval = setInterval(fetchPoints, 3000);
    return () => clearInterval(interval);
  }, []);

  const resetForm = () => {
    setDescription('');
    setNotes('');
    setMediaFile(null);
    setSelectedLatLng(null);
    setRawLocationInput('');
    setTime(new Date().toISOString().substring(0, 16));
    setEditingPointId(null);
  };

  const handleAISummarize = async () => {
    if (!rawLocationInput.trim()) return;
    setIsSummarizing(true);
    try {
      const lastPoint = points[points.length - 1];
      const referenceTime = lastPoint ? lastPoint.timestamp : new Date().toISOString();

      const response = await axios.post(`${API_BASE_URL}/api/summarize`, {
        text: rawLocationInput,
        referenceTime
      });

      const { time: aiTime, description: aiDesc, notes: aiNotes } = response.data;
      if (aiTime) setTime(aiTime.split('.')[0]);
      if (aiDesc) setDescription(aiDesc);
      if (aiNotes) setNotes(aiNotes);
    } catch (err) {
      console.error('Lỗi AI:', err);
      alert('Không thể kết nối AI để tổng hợp. Vui lòng kiểm tra lại tin nhắn.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const parseLocationInput = (text: string) => {
    setRawLocationInput(text);
    if (!text.trim()) return;

    if (!editingPointId) {
      const lines = text.split('\n');
      const firstLine = lines[0].trim();
      setDescription(firstLine.length > 50 ? firstLine.substring(0, 50) + "..." : firstLine);
      setNotes(text);
    }

    let locMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!locMatch) {
      locMatch = text.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    }
    if (locMatch) {
      const lat = parseFloat(locMatch[1]);
      const lng = parseFloat(locMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setSelectedLatLng({ lat, lng });
      }
    }

    const timeMatch = text.match(/(?:lúc|khoảng)?\s*(\d{1,2})[h:](\d{1,2})[p']?(?:\s+ngày\s+(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?)?/i);
    if (timeMatch) {
      const hh = parseInt(timeMatch[1]);
      const mm = parseInt(timeMatch[2]);
      let dd = new Date().getDate();
      let mo = new Date().getMonth() + 1;
      let yyyy = new Date().getFullYear();

      if (timeMatch[3] && timeMatch[4]) {
        dd = parseInt(timeMatch[3]);
        mo = parseInt(timeMatch[4]);
      }
      if (timeMatch[5]) {
        yyyy = parseInt(timeMatch[5]);
      }

      const formattedDate = `${yyyy}-${mo.toString().padStart(2, '0')}-${dd.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
      setTime(formattedDate);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Trình duyệt của bạn không hỗ trợ định vị GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setSelectedLatLng({ lat: latitude, lng: longitude });
        setTime(new Date().toISOString().substring(0, 16));
        alert("✅ Đã lấy tọa độ hiện tại thành công!");
      },
      (error) => {
        console.error("GPS Error:", error);
        alert("⚠️ Không thể lấy vị trí. Vui lòng bật GPS trên thiết bị.");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    setMediaFile(file);
    if (!file) return;

    try {
      if (file.type.startsWith('image/')) {
        const metadata = await exifr.parse(file, { gps: true, tiff: true, exif: true });
        
        if (metadata) {
          let updated = false;
          if (metadata.latitude && metadata.longitude) {
            setSelectedLatLng({ lat: metadata.latitude, lng: metadata.longitude });
            updated = true;
          }
          const exifDate = metadata.DateTimeOriginal || metadata.CreateDate || metadata.ModifyDate;
          if (exifDate instanceof Date) {
            const dt = new Date(exifDate);
            dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
            setTime(dt.toISOString().slice(0, 16));
            updated = true;
          }
          if (updated) {
            alert('✅ Đã quét file thành công tọa độ & thời gian.');
          }
        }
      }
    } catch (err) {
      console.log('No EXIF data found', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLatLng) {
      alert('Vui lòng click vào bản đồ hoặc nhập tọa độ');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('lat', selectedLatLng.lat.toString());
    formData.append('lng', selectedLatLng.lng.toString());
    formData.append('timestamp', new Date(time).toISOString());
    formData.append('description', description);
    formData.append('notes', notes);
    
    if (mediaFile) {
      formData.append('media', mediaFile);
    }

    try {
      if (editingPointId) {
        await axios.put(`${API_URL}/${editingPointId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        formData.append('type', points.length === 0 ? 'stolen_location' : 'sighting');
        await axios.post(API_URL, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      resetForm();
      setSheetOpen(null);
      setIsFormOpen(false);
      await fetchPoints();
    } catch (err) {
      alert('Lỗi truy xuất hệ thống');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (point: TrackingPoint) => {
    setEditingPointId(point.id);
    setSelectedLatLng({ lat: point.lat, lng: point.lng });
    setDescription(point.description);
    setNotes(point.notes || '');
    const dt = new Date(point.timestamp);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    setTime(dt.toISOString().slice(0, 16));
    setMediaFile(null);
    setSheetOpen('form');
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Xóa dấu vết này khỏi hệ thống?')) {
      try {
        await axios.delete(`${API_URL}/${id}`);
        if (editingPointId === id) resetForm();
        await fetchPoints();
      } catch (err) {
        alert('Lỗi xóa điểm');
      }
    }
  };

  return (
    <div id="root">
      
      {/* MAP LAYER */}
      <div className="map-container">
        <MapComponent 
          points={points} 
          selectedLatLng={selectedLatLng} 
          onMapClick={(lat, lng) => {
            if (isPinningMode) {
              setSelectedLatLng({lat, lng});
              setIsFormOpen(true);
              setSheetOpen('form');
            }
          }} 
        />
      </div>

      {/* FLOATING TOP BAR */}
      <div className="top-bar glass-panel">
        <div className="brand-title">
          <AlertTriangle size={20} />
          Trạm QL6
        </div>
        <div style={{fontSize: '0.8rem', opacity: 0.8}}>
          {points.length} dấu vết
        </div>
      </div>

      {/* FABs */}
      {!isFormOpen && (
        <div className="fab-container left">
          <button 
            className={`fab-extended ${isPinningMode ? 'active' : ''}`}
            onClick={() => setIsPinningMode(!isPinningMode)}
            style={{ background: isPinningMode ? '#ff4757' : '#2f3542', boxShadow: isPinningMode ? '0 0 15px rgba(255, 71, 87, 0.5)' : '' }}
          >
            {isPinningMode ? <X size={20} /> : <Plus size={20} />}
            <span>{isPinningMode ? "Hủy ghim" : "Ghim trên bản đồ"}</span>
          </button>
        </div>
      )}

      {!isFormOpen && (
        <div className="fab-container left-sub">
          <button 
            className="fab-extended" 
            onClick={() => {
              setIsFormOpen(true);
              setEditingPointId(null);
              resetForm();
              setSheetOpen('form');
            }}
            style={{ background: '#3498db', boxShadow: '0 4px 15px rgba(52, 152, 219, 0.4)', color: 'white', border: 'none' }}
          >
            <Plus size={22} />
            <span>Thêm dấu vết</span>
          </button>
        </div>
      )}

      <div className="fab-container-right">
        <button className="fab fab-secondary" onClick={() => setSheetOpen('list')} title="Nhật ký">
          <List size={24} />
        </button>
      </div>

      {/* OVERLAY BACKDROP */}
      <div className={`overlay ${sheetOpen ? 'visible' : ''}`} onClick={() => {setSheetOpen(null); setIsFormOpen(false);}} />

      {/* BOTTOM SHEET FOR FORM */}
      <div className={`bottom-sheet glass-panel ${sheetOpen === 'form' ? 'open' : ''}`}>
        <div className="sheet-header">
          <h2>{editingPointId ? 'Sửa dấu vết' : 'Ghi nhận vị trí'}</h2>
          <button className="btn-close" onClick={() => {setSheetOpen(null); setIsFormOpen(false);}}><X size={20}/></button>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#ff4757', fontWeight: 'bold', marginBottom: '16px' }}>
          {selectedLatLng ? `📍 Tốc độ bắt: ${selectedLatLng.lat.toFixed(5)}, ${selectedLatLng.lng.toFixed(5)}` : '⚠️ Chưa có tọa độ! Hãy chấm trên bản đồ hoặc bấm nút GPS.'}
        </p>
        <div style={{ marginBottom: '15px' }}>
          <button 
            type="button" 
            className="gps-btn" 
            onClick={handleGetCurrentLocation}
          >
            📍 Lấy vị trí GPS hiện tại
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Nội dung cần xử lý (Dán từ Zalo)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <textarea 
                className="form-control"
                value={rawLocationInput}
                onChange={(e) => parseLocationInput(e.target.value)}
                placeholder="Dán link Google Maps hoặc tin nhắn Zalo vào đây..."
                rows={3}
              />
              <button 
                type="button" 
                className="ai-btn"
                onClick={handleAISummarize}
                disabled={isSummarizing || !rawLocationInput}
                title="AI Tổng hợp lộ trình"
              >
                {isSummarizing ? "..." : "🤖 Tổng hợp"}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Thời điểm phát hiện</label>
            <input 
              type="datetime-local" 
              className="form-control"
              value={time}
              onChange={e => setTime(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Đặc điểm nhận dạng (Mô tả ngắn gọn)</label>
            <input 
              type="text" 
              className="form-control"
              placeholder="VD: Nam, áo đen, xe Exciter..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Ghi chú mở rộng (Không giới hạn định dạng)</label>
            <textarea 
              className="form-control"
              placeholder="Có thể ghi thêm thông tin tự do..."
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label><ImageIcon size={14} style={{verticalAlign: 'middle', marginRight: '4px'}}/>Ảnh gốc (Tự rút Tọa độ gốc)</label>
            <input 
              type="file" 
              className="form-control"
              accept="image/*,video/*"
              onChange={handleFileChange}
            />
          </div>
          <button type="submit" className="btn-submit" disabled={isSubmitting || !selectedLatLng}>
            <Send size={18} />
            {isSubmitting ? 'Đang gửi...' : (editingPointId ? 'Lưu Thay Đổi' : 'Phát Tín Hiệu')}
          </button>
        </form>
      </div>

      {/* BOTTOM SHEET FOR LIST */}
      <div className={`bottom-sheet glass-panel ${sheetOpen === 'list' ? 'open' : ''}`} style={{height: '70vh'}}>
        <div className="sheet-header">
          <h2>Nhật ký tẩu thoát</h2>
          <button className="btn-close" onClick={() => setSheetOpen(null)}><X size={20}/></button>
        </div>
        <div className="point-list">
          {points.length === 0 && <p style={{color: '#888'}}>Chưa có dữ liệu.</p>}
          {points.map((p, idx) => {
            const pointDate = new Date(p.timestamp);
            const timeFormat = pointDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const dateFormat = pointDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

            return (
              <div key={p.id} className="point-item">
                <div className="point-item-header">
                  <strong>#{idx + 1}</strong>
                  <span className="point-time">{`${timeFormat} ngày ${dateFormat}`}</span>
                </div>
                <p style={{fontSize: '0.95rem', fontWeight: 'bold', color: '#fff', marginTop: '4px'}}>{p.description}</p>
                
                {p.notes && <p style={{fontSize: '0.85rem', color: '#bbb', marginTop: '4px', whiteSpace: 'pre-wrap'}}>{p.notes}</p>}

                <p style={{fontSize: '0.8rem', color: '#888', marginTop: '8px'}}>
                  Tọa độ: {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </p>

                {p.mediaUrl && (
                  <div style={{marginTop: '12px'}}>
                    {p.mediaType?.includes('video') ? (
                      <video src={p.mediaUrl ?? ''} controls className="popup-image" />
                    ) : (
                      <img src={p.mediaUrl ?? ''} alt="Sighting" className="popup-image" />
                    )}
                  </div>
                )}
                <div className="point-actions">
                  <button className="btn-small" onClick={() => handleEdit(p)}><Edit size={12}/> Sửa</button>
                  <button className="btn-small btn-delete" onClick={() => handleDelete(p.id)}><Trash2 size={12}/> Xóa</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

export default App;
