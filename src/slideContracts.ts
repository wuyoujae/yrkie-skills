import * as z from 'zod';

export const slideRevisionSchema=z.number().int().positive().safe();
export const slideDocumentSchema=z.record(z.string(),z.unknown());
export const currentDeckSchema=z.object({revision:slideRevisionSchema,status:z.enum(['active','deleted'])}).nullable();
export const slideWriteResultSchema=z.object({
  requestId:z.string().uuid(),projectRef:z.string().regex(/^prj_[a-f0-9]{64}$/),
  revision:slideRevisionSchema,totalSlides:z.number().int().min(1).max(200),
  pageNumber:slideRevisionSchema.nullable(),status:z.enum(['saved','edited','deleted']),replayed:z.boolean(),
});
