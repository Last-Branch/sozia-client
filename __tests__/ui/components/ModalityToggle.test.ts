/**
 * @jest-environment node
 */
import { ModalityPath } from '@common/models';
import {
  buildToggleState,
  type ToggleOption,
} from '@/ui/components/ModalityToggle/helpers';

describe('buildToggleState', () => {
  it('returns two options for SPEECH and SIGN', () => {
    const options = buildToggleState(ModalityPath.SPEECH, false);
    expect(options).toHaveLength(2);
    expect(options[0].path).toBe(ModalityPath.SPEECH);
    expect(options[1].path).toBe(ModalityPath.SIGN);
  });

  it('marks SPEECH as active when selectedPath is SPEECH', () => {
    const options = buildToggleState(ModalityPath.SPEECH, false);
    expect(options[0].isActive).toBe(true);
    expect(options[1].isActive).toBe(false);
  });

  it('marks SIGN as active when selectedPath is SIGN', () => {
    const options = buildToggleState(ModalityPath.SIGN, false);
    expect(options[0].isActive).toBe(false);
    expect(options[1].isActive).toBe(true);
  });

  it('sets disabled on all options when disabled is true', () => {
    const options = buildToggleState(ModalityPath.SPEECH, true);
    expect(options.every((o) => o.disabled)).toBe(true);
  });

  it('sets disabled false on all options when disabled is false', () => {
    const options = buildToggleState(ModalityPath.SPEECH, false);
    expect(options.every((o) => !o.disabled)).toBe(true);
  });

  it('includes correct i18n label keys', () => {
    const options = buildToggleState(ModalityPath.SPEECH, false);
    expect(options[0].labelKey).toBe('modality.speech');
    expect(options[1].labelKey).toBe('modality.sign');
  });
});
