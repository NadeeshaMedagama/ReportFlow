import { avatarColor, cn, initials } from '@/lib/utils';

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dimension = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-9 w-9 text-xs';
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', avatarColor(name), dimension, className)} aria-hidden>
      {initials(name)}
    </span>
  );
}
