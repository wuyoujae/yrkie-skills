import * as z from 'zod';
const integer=z.number().int().nonnegative().safe();
const version=z.number().int().positive().safe();
export const imageTypeSchema=z.enum(['content','decorative']);
export const imageRatioSchema=z.enum(['1:1','4:3','3:4','4:5','16:9','9:16']);
export const confirmationRefSchema=z.string().regex(/^cnf_[0-9a-f]{64}$/);
const reference=z.string().regex(/^yrkie-asset-data:\/\/[0-9a-f]{64}$/);
const request=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const expiry=z.string().datetime({offset:true}).nullable();
const path=z.string().regex(/^\/body\/[0-9]{1,2}\/contents\/[0-9]{1,2}$/);
const asset=z.object({slideReference:reference,page:version.max(100),path,imageType:imageTypeSchema,ratio:imageRatioSchema,source:z.enum(['upload','platform']),width:integer.max(8192).optional(),height:integer.max(8192).optional(),hasTransparency:z.boolean().optional(),sizeBytes:integer.max(20*1024*1024).optional()});
export const uploadResultSchema=z.object({requestId:request,slideReference:reference,imageType:imageTypeSchema,ratio:imageRatioSchema,width:version.max(8192),height:version.max(8192),hasTransparency:z.boolean(),contentType:z.literal('image/png'),sizeBytes:version.max(20*1024*1024),expiresAt:expiry,replayed:z.boolean()});
export const preparationSchema=z.object({confirmationRef:confirmationRefSchema.nullable(),expiresAt:expiry,action:z.enum(['confirm','retry_images']),outlineVersion:version,revision:version,totalPages:version.max(100),eligiblePages:version.max(100),excludedPageRanges:z.array(z.object({from:version.max(100),to:version.max(100)})).max(1),excludedImagePlans:integer.max(16),imagePlan:z.array(z.object({page:version.max(100),path,imageType:imageTypeSchema,ratio:imageRatioSchema,prompt:z.string().min(1).max(8000)})).max(16),assets:z.array(asset).max(256),canConfirm:z.boolean(),blockers:z.array(z.enum(['insufficient_credits','image_service_unavailable'])).max(3),billingDisclosure:z.object({paidGeneration:z.boolean(),mode:z.literal('actual_attempt_cost'),failedAttemptsMayCharge:z.boolean(),estimateIsFixedPrice:z.literal(false),message:z.string().max(2000)})}).superRefine((v,ctx)=>{
  if(v.eligiblePages>v.totalPages || (v.canConfirm && (!v.confirmationRef || !v.expiresAt || v.blockers.length)))ctx.addIssue({code:'custom',message:'Invalid confirmation review'});
});
export const confirmationResultSchema=z.object({requestId:request,outlineVersion:version,sourceRevision:version,currentRevision:version,status:z.literal('confirmed'),eligiblePages:version.max(100),paidGeneration:z.boolean(),imageStatus:z.enum(['queued','not_required']),ready:z.boolean(),replayed:z.boolean(),currentOutline:z.object({version,revision:version,status:z.enum(['draft','confirmed'])}).nullable().optional()});
export const imageStatusSchema=z.object({outlineVersion:version,revision:version,confirmed:z.boolean(),eligiblePages:version.max(100),status:z.enum(['queued','running','succeeded','failed','not_started','not_required']),ready:z.boolean(),total:integer.max(16),completed:integer.max(16),failed:integer.max(16),items:z.array(z.object({page:version.max(100),path,status:z.enum(['queued','running','succeeded','failed']),errorCode:z.string().regex(/^[a-z0-9_]{1,128}$/).nullable()})).max(16),assets:z.array(asset).max(272),errorCode:z.string().regex(/^[a-z0-9_]{1,128}$/).nullable(),creditsCharged:integer,settlementComplete:z.boolean()}).superRefine((v,ctx)=>{
  if(v.completed>v.total || v.failed>v.total || (v.ready&&(!v.confirmed||!v.settlementComplete||!['succeeded','not_required'].includes(v.status))))ctx.addIssue({code:'custom',message:'Invalid image status'});
});
