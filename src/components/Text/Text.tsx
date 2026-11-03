import { createText } from '@shopify/restyle';

import type { Theme } from '@theme';

export const Text = createText<Theme>();
export type TextProps = React.ComponentProps<typeof Text>;
