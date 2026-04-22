import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const logoSource = require('../../assets/sozia_logo.png');

interface SoziaLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function SoziaLogo({ size = 80, style }: SoziaLogoProps) {
  return (
    <Image
      source={logoSource}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
