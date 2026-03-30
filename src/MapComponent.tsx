import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TrackingPoint } from './App';

// Setup custom marker for current clicked location ONLY
const redIcon = new L.Icon({
  iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle clicks on the map to set a new point
export function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Map automatically bounds to see all tracking points BUT only when requested or first load
export function MapAutoBounder({ points }: { points: TrackingPoint[] }) {
  const map = useMap();
  const pointsCountRef = useRef(points.length);

  useEffect(() => {
    // Chỉ tự động fit bounds khi số lượng điểm thay đổi (vừa thêm điểm mới)
    // HOẶC nếu đây là lần đầu tiên có dữ liệu
    if (points.length > 0 && points.length !== pointsCountRef.current) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      pointsCountRef.current = points.length;
    }
  }, [points, map]);

  return null;
}

// Component to fetch and display actual road path using OSRM
function RoadRouting({ points }: { points: TrackingPoint[] }) {
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);

  useEffect(() => {
    if (points.length < 2) {
      setRouteCoords([]);
      return;
    }

    const fetchRoute = async () => {
      try {
        // OSRM coordinates format: lng,lat;lng,lat
        const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          const geometry = data.routes[0].geometry;
          // Leaflet expects [lat, lng], GeoJSON provides [lng, lat]
          const mapped = geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
          setRouteCoords(mapped);
        }
      } catch (err) {
        console.error('Routing error:', err);
        // Fallback to straight lines if OSRM fails
        setRouteCoords(points.map(p => [p.lat, p.lng]));
      }
    };

    fetchRoute();
  }, [points]);

  return routeCoords.length > 0 ? (
    <Polyline positions={routeCoords} color="#ff4757" weight={5} opacity={0.7} dashArray="10, 10" lineJoin="round" />
  ) : null;
}

interface MapComponentProps {
  points: TrackingPoint[];
  selectedLatLng: {lat: number, lng: number} | null;
  onMapClick: (lat: number, lng: number) => void;
}

export default function MapComponent({ points, selectedLatLng, onMapClick }: MapComponentProps) {
  const initCenter: [number, number] = [20.7335, 105.2933];

  return (
    <MapContainer 
      center={initCenter} 
      zoom={13} 
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <ClickHandler onMapClick={onMapClick} />
      <MapAutoBounder points={points} />
      <RoadRouting points={points} />

      {/* Simple DOS Dots for Tracking Points */}
      {points.map((p, index) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={7}
          pathOptions={{
            color: index === 0 ? '#ff4757' : '#3498db',
            fillColor: index === 0 ? '#ff4757' : '#3498db',
            fillOpacity: 1,
            weight: 2
          }}
        >
          <Popup className="custom-popup">
            <div className="tooltip-content">
              <span className="tooltip-time">
                #{index + 1} - {new Date(p.timestamp).toLocaleString('vi-VN', {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}
              </span>
              <span className="tooltip-desc">{p.description}</span>
              <span className="tooltip-coord">
                📍 {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
              </span>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Existing popup for the clicked (but not yet saved) location */}
      {selectedLatLng && (
        <Marker position={[selectedLatLng.lat, selectedLatLng.lng]} icon={redIcon}>
          <Popup>Vị trí bạn đang chọn</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
