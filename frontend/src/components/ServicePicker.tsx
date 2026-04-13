// src/components/ServicePicker.tsx
import { IMAGE_SERVICES } from '../imageServices'
import type { ImageService } from '../types'

interface Props {
  selected: ImageService
  onSelect: (service: ImageService) => void
}

export function ServicePicker({ selected, onSelect }: Props) {
  return (
    <div className="service-picker">
      <label className="service-label" htmlFor="service-select">
        🎨 Image Engine
      </label>
      <select
        id="service-select"
        className="service-select"
        value={selected.id}
        onChange={e => {
          const svc = IMAGE_SERVICES.find(s => s.id === e.target.value)
          if (svc) onSelect(svc)
        }}
      >
        {IMAGE_SERVICES.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <span className="service-desc">{selected.description}</span>
    </div>
  )
}
