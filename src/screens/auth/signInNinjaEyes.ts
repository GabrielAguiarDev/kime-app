// Eyes of assets/auth/sign-in-ninja.png (1448×1086), drawn 1:1 over it by MascotEyes.
// Extracted from the PNG by pixel analysis (white of each eye → convex outline; pupil and shine
// measured; eyelid = the mask's orange, tilted along each lid line). The art keeps its own
// brows (baked in the PNG): none here. Re-measure if the image changes.
import type { MascotEyesShape } from '@components';

export const SIGN_IN_NINJA_EYES: MascotEyesShape = {
  "viewBox": "0 0 1448 1086",
  "rootTransform": "",
  "left": {
    "clip": "M805.8 420.8 L806.8 416.8 L807.9 413.7 L808.9 413.7 L898.5 446.2 L898.5 455.4 L897.5 459.5 L895.5 465.6 L893.5 469.7 L891.5 472.7 L883.4 481 L880.3 483 L874.2 486.2 L866.1 488.3 L850.6 488.5 L846.4 487.5 L840.2 485.5 L835 483.4 L832.9 482.3 L826.7 478.1 L817.5 468.7 L813.5 462.5 L809.5 454.3 L806.6 445.1 L805.6 441.1 Z",
    "white": {
      "d": "M805.8 420.8 L806.8 416.8 L807.9 413.7 L808.9 413.7 L898.5 446.2 L898.5 455.4 L897.5 459.5 L895.5 465.6 L893.5 469.7 L891.5 472.7 L883.4 481 L880.3 483 L874.2 486.2 L866.1 488.3 L850.6 488.5 L846.4 487.5 L840.2 485.5 L835 483.4 L832.9 482.3 L826.7 478.1 L817.5 468.7 L813.5 462.5 L809.5 454.3 L806.6 445.1 L805.6 441.1 Z",
      "fill": "#FAFAFA"
    },
    "shade": {
      "d": "",
      "stroke": "#CFCFD6",
      "strokeWidth": 0,
      "opacity": 0
    },
    "pupil": {
      "cx": 865.5,
      "cy": 445.5,
      "rx": 30,
      "ry": 30,
      "angle": 0,
      "fill": "#141210"
    },
    "shine": {
      "cx": 877.5,
      "cy": 443.5,
      "r": 9.5,
      "fill": "#FFFFFF"
    },
    "eyelid": {
      "x": 777.7,
      "y": 391.3,
      "width": 148.6,
      "height": 119.6,
      "fill": "#FD5303",
      "transform": "rotate(19.9 852 451.1)"
    },
    "browAngry": [],
    "brow": {
      "d": "",
      "fill": "none"
    }
  },
  "right": {
    "clip": "M963.5 431.5 L974.5 424.4 L1045.7 379.5 L1055.8 373.6 L1067.9 367.6 L1072 372.6 L1075.1 376.7 L1078.2 382.7 L1080.2 387.8 L1081.3 390.8 L1082.3 394.9 L1083.4 402 L1083.4 410.1 L1082.5 418.3 L1081.5 422.3 L1079.5 428.5 L1076.5 435.7 L1073.5 440.8 L1069.4 447 L1060.1 456.3 L1056 459.3 L1052.9 461.4 L1042.6 466.5 L1036.5 468.5 L1026.2 470.5 L1009.9 470.3 L999.8 468.2 L993.7 466.1 L987.7 463.1 L984.6 461 L980.6 458 L972.5 449.8 L969.5 445.7 L966.5 439.6 L964.5 434.6 Z",
    "white": {
      "d": "M963.5 431.5 L974.5 424.4 L1045.7 379.5 L1055.8 373.6 L1067.9 367.6 L1072 372.6 L1075.1 376.7 L1078.2 382.7 L1080.2 387.8 L1081.3 390.8 L1082.3 394.9 L1083.4 402 L1083.4 410.1 L1082.5 418.3 L1081.5 422.3 L1079.5 428.5 L1076.5 435.7 L1073.5 440.8 L1069.4 447 L1060.1 456.3 L1056 459.3 L1052.9 461.4 L1042.6 466.5 L1036.5 468.5 L1026.2 470.5 L1009.9 470.3 L999.8 468.2 L993.7 466.1 L987.7 463.1 L984.6 461 L980.6 458 L972.5 449.8 L969.5 445.7 L966.5 439.6 L964.5 434.6 Z",
      "fill": "#FAFAFA"
    },
    "shade": {
      "d": "",
      "stroke": "#CFCFD6",
      "strokeWidth": 0,
      "opacity": 0
    },
    "pupil": {
      "cx": 1018.5,
      "cy": 418.5,
      "rx": 37,
      "ry": 37,
      "angle": 0,
      "fill": "#141210"
    },
    "shine": {
      "cx": 1032,
      "cy": 401.5,
      "r": 12,
      "fill": "#FFFFFF"
    },
    "eyelid": {
      "x": 927.5,
      "y": 336.7,
      "width": 191.9,
      "height": 164.6,
      "fill": "#FD5303",
      "transform": "rotate(-32.2 1023.5 419)"
    },
    "browAngry": [],
    "brow": {
      "d": "",
      "fill": "none"
    }
  }
};

/** Pupil shift on a glance, in image pixels (~15 % of the eye's width). */
export const SIGN_IN_NINJA_LOOK_OFFSET = 16;
