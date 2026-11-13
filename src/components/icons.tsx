/** Phosphor "CaretLeft" / "CaretRight" (bold weight), inlined. */

interface IconProps {
  size: number;
}

function Icon({ size, d }: IconProps & { d: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="currentColor"
      viewBox="0 0 256 256"
    >
      <path d={d} />
    </svg>
  );
}

export function CaretLeftIcon({ size }: IconProps) {
  return (
    <Icon
      size={size}
      d="M168.49,199.51a12,12,0,0,1-17,17l-80-80a12,12,0,0,1,0-17l80-80a12,12,0,0,1,17,17L97,128Z"
    />
  );
}

export function CaretRightIcon({ size }: IconProps) {
  return (
    <Icon
      size={size}
      d="M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z"
    />
  );
}
