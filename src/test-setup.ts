import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    stop: vi.fn(),
    fade: vi.fn(),
    volume: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    unload: vi.fn(),
  })),
  Howler: { volume: vi.fn() },
}));
