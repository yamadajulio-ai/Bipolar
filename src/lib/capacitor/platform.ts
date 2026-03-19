/**
 * Platform detection utilities for Capacitor native vs web.
 */
import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

export function isWeb(): boolean {
  return Capacitor.getPlatform() === 'web';
}
