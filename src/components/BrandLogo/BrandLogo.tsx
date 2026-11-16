import { Image } from 'expo-image';

const source = require('../../../assets/brand/kimi-wordmark.png');
const aspectRatio = 1039 / 542;

export function BrandLogo({ width }: { width: number }) {
  return (
    <Image
      source={source}
      contentFit="contain"
      style={{ width, aspectRatio }}
      accessible
      accessibilityLabel="Kimi"
    />
  );
}
