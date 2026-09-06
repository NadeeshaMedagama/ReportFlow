import { Transform } from 'class-transformer';

/**
 * Query strings arrive as text. With implicit conversion enabled, "false" would
 * become `true`, so booleans are parsed explicitly from the raw value instead.
 */
export const ToBoolean = () =>
  Transform(({ obj, key }) => {
    const raw = obj[key];
    if (raw === undefined || raw === null || raw === '') return undefined;
    return raw === true || raw === 'true' || raw === '1';
  });
