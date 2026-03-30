import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMapEvents, useMap } from 'react-leaflet';
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

// Map automatically bounds to see all tracking points
export function MapAutoBounder({ points }: { points: TrackingPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [points, map]);
  return null;
}

interface MapComponentProps {
  points: TrackingPoint[];
  selectedLatLng: {lat: number, lng: number} | null;
  onMapClick: (lat: number, lng: number) => void;
}

export default function MapComponent({ points, selectedLatLng, onMapClick }: MapComponentProps) {
  const initCenter: [number, number] = [20.7335, 105.2933];
  const polylinePositions = points.map(p => [p.lat, p.lng] as [number, number]);

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
      {points.length > 0 && <MapAutoBounder points={points} />}

      {/* Polyline connecting the chronological spots */}
      <Polyline positions={polylinePositions} color="#ff4757" weight={4} dashArray="5, 10" />

      {/* Simple DOS Dots for Tracking Points instead of huge Marker pins */}
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
          {/* Always display this floating label next to the dot without needing a click */}
          <Tooltip direction="right" offset={[10, 0]} opacity={0.9} permanent className="custom-tooltip">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ color: '#ff4757', fontWeight: 700 }}>
                {new Date(p.timestamp).toLocaleString('vi-VN', {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}
              </span>
              <span style={{ fontWeight: 600 }}>{p.description}</span>
              <span style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '2px' }}>
                📍 {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
              </span>
            </div>
          </Tooltip>
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
