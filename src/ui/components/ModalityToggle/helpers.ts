import { ModalityPath } from '../../../common/models';

export interface ToggleOption {
  path: ModalityPath;
  labelKey: string;
  isActive: boolean;
  disabled: boolean;
}

export function buildToggleState(selectedPath: ModalityPath, disabled: boolean): ToggleOption[] {
  return [
    {
      path: ModalityPath.SPEECH,
      labelKey: 'modality.speech',
      isActive: selectedPath === ModalityPath.SPEECH,
      disabled,
    },
    {
      path: ModalityPath.SIGN,
      labelKey: 'modality.sign',
      isActive: selectedPath === ModalityPath.SIGN,
      disabled,
    },
  ];
}
