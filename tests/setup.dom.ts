import { configure } from '@testing-library/react'

/**
 * Testing Library's default `findBy*` timeout is 1s. These tests mount the
 * real app, so each assertion waits on a lazily-imported route chunk — which
 * can exceed 1s when the machine is busy (for example while the Firestore
 * emulator suite runs alongside). That produced a flake.
 *
 * A longer ceiling removes the false failure without hiding a real one: a
 * genuinely broken render still fails, just five seconds later.
 */
configure({ asyncUtilTimeout: 5000 })
