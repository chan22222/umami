import { createSpritfyUtmHandler } from '@/lib/spritfy-analytics.mjs';
import { getUTM } from '@/queries/sql/reports/getUTM';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = createSpritfyUtmHandler({ query: getUTM });
