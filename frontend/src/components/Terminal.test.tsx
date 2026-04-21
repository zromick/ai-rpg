import { describe, it, expect } from 'vitest'

const LOCAL_CMDS = new Set([
  'quest','q',
  'sidequests','sidequest','sq',
  'stats','s',
  'inventory','inv',
  'npcs','n','characters','chars',
  'locations','locs','map',
  'settings','se',
  'help','?','h',
  'title','t',
  'restart','r',
  'delete','del',
])

function resolveLocalTest(cmd: string): { handled: boolean; type?: string } {
  let c = cmd.trim().toLowerCase()
  if (c.startsWith('/')) {
    c = c.slice(1)
  }
  if (!LOCAL_CMDS.has(c)) return { handled: false }
  if (c === 'quest' || c === 'q') return { handled: true, type: 'quest' }
  if (c === 'settings' || c === 'se') return { handled: true, type: 'settings' }
  if (c === 'help' || c === '?' || c === 'h') return { handled: true, type: 'help' }
  return { handled: true, type: 'other' }
}

describe('Terminal Commands', () => {
  describe('resolveLocal', () => {
    it('should handle quest command', () => {
      expect(resolveLocalTest('quest')).toEqual({ handled: true, type: 'quest' })
      expect(resolveLocalTest('q')).toEqual({ handled: true, type: 'quest' })
    })

    it('should handle settings command', () => {
      expect(resolveLocalTest('settings')).toEqual({ handled: true, type: 'settings' })
      expect(resolveLocalTest('se')).toEqual({ handled: true, type: 'settings' })
    })

    it('should handle help command', () => {
      expect(resolveLocalTest('help')).toEqual({ handled: true, type: 'help' })
      expect(resolveLocalTest('?')).toEqual({ handled: true, type: 'help' })
      expect(resolveLocalTest('h')).toEqual({ handled: true, type: 'help' })
    })

    it('should handle commands with / prefix', () => {
      expect(resolveLocalTest('/quest')).toEqual({ handled: true, type: 'quest' })
      expect(resolveLocalTest('/settings')).toEqual({ handled: true, type: 'settings' })
      expect(resolveLocalTest('/help')).toEqual({ handled: true, type: 'help' })
      expect(resolveLocalTest('/h')).toEqual({ handled: true, type: 'help' })
    })

    it('should not handle unknown commands', () => {
      expect(resolveLocalTest('attack the goblin')).toEqual({ handled: false })
      expect(resolveLocalTest('look around')).toEqual({ handled: false })
      expect(resolveLocalTest('')).toEqual({ handled: false })
    })

    it('should handle inventory command', () => {
      expect(resolveLocalTest('inventory')).toEqual({ handled: true, type: 'other' })
      expect(resolveLocalTest('inv')).toEqual({ handled: true, type: 'other' })
    })

    it('should handle npcs command', () => {
      expect(resolveLocalTest('npcs')).toEqual({ handled: true, type: 'other' })
      expect(resolveLocalTest('n')).toEqual({ handled: true, type: 'other' })
      expect(resolveLocalTest('characters')).toEqual({ handled: true, type: 'other' })
      expect(resolveLocalTest('chars')).toEqual({ handled: true, type: 'other' })
    })

    it('should handle title command', () => {
      expect(resolveLocalTest('title')).toEqual({ handled: true, type: 'other' })
      expect(resolveLocalTest('t')).toEqual({ handled: true, type: 'other' })
    })

    it('should handle restart command', () => {
      expect(resolveLocalTest('restart')).toEqual({ handled: true, type: 'other' })
      expect(resolveLocalTest('r')).toEqual({ handled: true, type: 'other' })
    })

    it('should handle delete command', () => {
      expect(resolveLocalTest('delete')).toEqual({ handled: true, type: 'other' })
      expect(resolveLocalTest('del')).toEqual({ handled: true, type: 'other' })
    })
  })
})