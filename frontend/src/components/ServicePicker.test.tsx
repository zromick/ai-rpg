// src/components/ServicePicker.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ServicePicker } from './ServicePicker'
import { IMAGE_SERVICES, getService } from '../imageServices'

const mockService = IMAGE_SERVICES[0]

describe('ServicePicker', () => {
  it('renders all service options', () => {
    render(<ServicePicker selected={mockService} onSelect={vi.fn()} />)
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(IMAGE_SERVICES.length)
    expect(options[0]).toHaveTextContent(IMAGE_SERVICES[0].name)
  })

  it('shows current service as selected', () => {
    const service = IMAGE_SERVICES[2]
    render(<ServicePicker selected={service} onSelect={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveValue(service.id)
  })

  it('displays selected service description', () => {
    const service = IMAGE_SERVICES[1]
    render(<ServicePicker selected={service} onSelect={vi.fn()} />)
    expect(screen.getByText(service.description)).toBeInTheDocument()
  })

  it('calls onSelect with correct service on change', () => {
    const onSelect = vi.fn()
    render(<ServicePicker selected={mockService} onSelect={onSelect} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: IMAGE_SERVICES[3].id } })
    expect(onSelect).toHaveBeenCalledWith(IMAGE_SERVICES[3])
  })

  it('renders label with emoji', () => {
    render(<ServicePicker selected={mockService} onSelect={vi.fn()} />)
    expect(screen.getByText('🎨 Image Engine')).toBeInTheDocument()
  })
})

describe('getService', () => {
  it('returns service by id', () => {
    const service = getService('pollinations_dark_fantasy')
    expect(service.id).toBe('pollinations_dark_fantasy')
  })

  it('returns first service for unknown id', () => {
    const fallback = getService('unknown-id')
    expect(fallback.id).toBe(IMAGE_SERVICES[0].id)
  })

  it('returns first service for empty string', () => {
    const fallback = getService('')
    expect(fallback.id).toBe(IMAGE_SERVICES[0].id)
  })
})

describe('IMAGE_SERVICES', () => {
  it('contains all expected service ids', () => {
    const ids = IMAGE_SERVICES.map(s => s.id)
    expect(ids).toContain('pollinations_default')
    expect(ids).toContain('pollinations_dark_fantasy')
    expect(ids).toContain('pollinations_painterly')
    expect(ids).toContain('pollinations_anime')
    expect(ids).toContain('pollinations_portrait')
    expect(ids).toContain('pollinations_ink_sketch')
    expect(ids).toContain('pollinations_widescreen')
  })

  it('has fetchImage function for each service', () => {
    for (const service of IMAGE_SERVICES) {
      expect(typeof service.fetchImage).toBe('function')
    }
  })
})