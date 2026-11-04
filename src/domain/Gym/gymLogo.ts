import { prepareSquareImage, SQUARE_IMAGE_SIZE } from '@utils/squareImage';

/** Square logos are stored at this size: small enough for the 2 MB bucket limit. */
export const LOGO_SIZE = SQUARE_IMAGE_SIZE;

/** Resizes the picked (square-cropped) image to 512×512 and compresses it as JPEG. */
export const prepareLogo = prepareSquareImage;
