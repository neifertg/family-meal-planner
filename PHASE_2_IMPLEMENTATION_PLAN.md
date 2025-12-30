# Phase 2 Receipt Scanning Enhancements - Implementation Plan

## Overview

Phase 2 adds two complementary enhancements to improve receipt scanning for edge cases:
1. **Chunking** - For very long receipts (30+ items)
2. **OCR Preprocessing** - For pixel-perfect positioning

## ✅ Completed: Phase 2 Utilities

### 1. Receipt Chunking Utility
**File:** `lib/utils/receipt-chunking.ts`

**Features:**
- Splits long receipts into 3 overlapping chunks (top 0-60%, middle 40-100%, bottom 60-100%)
- 20% overlap regions to ensure no items missed
- Deduplication logic for items in overlap regions
- Intelligent merging of chunk results

**Key Functions:**
- `shouldUseChunking(estimatedItemCount)` - Decision logic
- `generateChunks(estimatedItemCount)` - Creates chunk definitions
- `deduplicateChunkItems(chunkResults)` - Removes duplicates from overlaps
- `mergeChunkResults(chunkResults)` - Combines all chunks into final result
- `generateChunkPrompt(chunk, basePrompt)` - Chunk-specific extraction instructions

**When to Use:**
- Receipts with 30+ items (estimated or confirmed)
- Long receipts where Phase 1 shows <95% capture rate
- Very long receipts (40+ items) where chunking is almost always beneficial

**Cost Impact:**
- Short receipts (< 30 items): No change ($0.08-0.15)
- Long receipts (30-40 items): +$0.10-0.15 (3 extraction calls instead of 1)
- Very long receipts (40+ items): Worth the cost for accuracy improvement

---

### 2. OCR Preprocessing Utility
**File:** `lib/utils/receipt-ocr.ts`

**Features:**
- Browser-based OCR using Tesseract.js
- Extracts text with pixel-perfect bounding boxes
- Groups words into lines based on y-coordinate proximity
- Provides OCR context to Claude for better accuracy

**Key Functions:**
- `performOCR(imageBase64, mimeType)` - Runs Tesseract OCR
- `formatOCRForPrompt(ocrResult)` - Creates OCR context for Claude
- `calculatePositionFromOCR(ocrLineId, ocrResult)` - Pixel-perfect positioning
- `matchItemsToOCR(itemSourceText, ocrResult)` - Links items to OCR lines
- `shouldUseOCR(config)` - Decision logic (opt-in for Phase 2)

**When to Use:**
- When position accuracy is critical
- Receipts with irregular spacing (position_distribution = "irregular")
- High-quality images where OCR confidence >85%
- Optional: All receipts for maximum accuracy

**Cost Impact:**
- OCR processing: Client-side (free, but adds 2-5s processing time)
- Claude extraction: Same cost, but prompt is slightly larger (+100-200 tokens)
- Net cost impact: ~+$0.005-0.01 per receipt

---

## Implementation Strategy

### Option A: Opt-In via Query Parameter
Make Phase 2 features opt-in via API parameters:

```typescript
// API route: /api/scan-receipt
{
  imageData: "...",
  familyId: "...",
  options: {
    enable_chunking?: boolean,  // Default: false
    enable_ocr?: boolean,        // Default: false
    force_chunking?: boolean     // Default: false (auto-detect based on count)
  }
}
```

### Option B: Auto-Enable Based on Analytics
Use Phase 1 analytics to decide when to apply Phase 2:

```typescript
// After Phase 1 extraction
const analytics = generateReceiptAnalytics(receipt, metadata)

// Apply chunking if capture rate is low on long receipts
if (analytics.item_count > 30 && analytics.capture_metrics.capture_rate_estimate < 95) {
  console.log('[enhancer] Low capture rate detected, recommend chunking')
  // Could auto-retry with chunking or suggest to user
}

// Apply OCR if position distribution is irregular
if (analytics.position_metrics.position_distribution === 'irregular') {
  console.log('[enhancer] Irregular positioning, recommend OCR')
  // Could add OCR context for better positioning
}
```

### Option C: Hybrid Approach (Recommended)
1. **Default behavior**: Use Phase 1 (anchor calibration + gap detection)
2. **Auto-enable chunking**: If pre-scan estimates >35 items
3. **Offer OCR**: Show toggle in UI "Use OCR for better accuracy (+2-3s)"
4. **Learn from history**: If user's receipts consistently have issues, suggest enhancements

---

## Integration Points

### 1. Update API Route (`app/api/scan-receipt/route.ts`)

```typescript
import { shouldUseChunking, generateChunks, mergeChunkResults } from '@/lib/utils/receipt-chunking'
import { shouldUseOCR, performOCR, formatOCRForPrompt } from '@/lib/utils/receipt-ocr'

export async function POST(request: NextRequest) {
  const { imageData, familyId, options } = await request.json()

  // Optional: Pre-scan to estimate item count
  // const estimatedCount = await estimateItemCount(imageData, mimeType)

  // Decision: Should we use chunking?
  const useChunking = options?.enable_chunking ||
                      (options?.force_chunking && estimatedCount > 30)

  // Decision: Should we use OCR?
  const useOCR = options?.enable_ocr || false

  if (useChunking) {
    return await extractReceiptWithChunking(imageData, mimeType, learningExamples, estimatedCount)
  } else if (useOCR) {
    return await extractReceiptWithOCR(imageData, mimeType, learningExamples)
  } else {
    // Default: Phase 1 extraction
    return await extractReceiptFromImage(imageData, mimeType, learningExamples)
  }
}
```

### 2. New Extraction Functions

#### Chunking Flow:
```typescript
async function extractReceiptWithChunking(
  imageData: string,
  mimeType: string,
  learningExamples: any[],
  estimatedCount: number
) {
  const chunks = generateChunks(estimatedCount)

  // Extract each chunk in parallel
  const chunkPromises = chunks.map(chunk =>
    extractChunk(imageData, mimeType, chunk, learningExamples)
  )

  const chunkResults = await Promise.all(chunkPromises)

  // Merge and deduplicate
  const mergedItems = mergeChunkResults(chunkResults, estimatedCount)

  // Continue with verification and calibration on merged results
  // ...
}
```

#### OCR Hybrid Flow:
```typescript
async function extractReceiptWithOCR(
  imageData: string,
  mimeType: string,
  learningExamples: any[]
) {
  // Step 1: Run OCR (client-side or server-side)
  const ocrResult = await performOCR(imageData, mimeType)

  if (ocrResult) {
    // Step 2: Include OCR context in Claude prompt
    const ocrContext = formatOCRForPrompt(ocrResult)
    const enhancedPrompt = `${EXTRACTION_PROMPT}\n\n${ocrContext}`

    // Step 3: Extract with OCR-enhanced prompt
    const receipt = await extractWithPrompt(imageData, mimeType, enhancedPrompt, learningExamples)

    // Step 4: Match items to OCR lines for pixel-perfect positioning
    receipt.items = receipt.items.map(item => {
      const ocrLineId = matchItemsToOCR(item.source_text, ocrResult)
      if (ocrLineId !== null) {
        item.position_percent = calculatePositionFromOCR(ocrLineId, ocrResult)
        item.ocr_line_id = ocrLineId
      }
      return item
    })

    return receipt
  }

  // Fallback to regular extraction if OCR fails
  return await extractReceiptFromImage(imageData, mimeType, learningExamples)
}
```

---

## Testing Plan

### Phase 2A: Chunking Tests

**Test Cases:**
1. **30-item receipt**: Should NOT chunk (just below threshold)
2. **35-item receipt**: Should chunk into 3 sections
3. **50-item receipt**: Should chunk, verify no duplicates in overlap
4. **Wrinkled long receipt**: Should chunk AND use gap detection

**Success Criteria:**
- Capture rate >98% on 40+ item receipts
- No duplicate items from overlap regions
- Processing time <20 seconds (3 parallel calls)
- Cost: <$0.30 per long receipt

### Phase 2B: OCR Tests

**Test Cases:**
1. **Clean, flat receipt**: OCR should have >90% confidence
2. **Wrinkled receipt**: OCR confidence may be lower, Claude should correct errors
3. **Irregular spacing**: OCR positions should be more accurate than vision estimates
4. **Poor quality image**: OCR might fail, should gracefully fall back

**Success Criteria:**
- Position accuracy within ±1-2% (vs ±3-5% without OCR)
- Processing time +2-4 seconds for OCR
- OCR confidence >80% on average
- Graceful degradation if OCR fails

---

## Deployment Strategy

### Phase 2.1: Soft Launch (Week 1)
- Deploy utilities (chunking.ts, ocr.ts) ✅ DONE
- Make features opt-in via environment variable
- Test with 10-20 receipts internally
- Monitor analytics for improvements

### Phase 2.2: Selective Rollout (Week 2)
- Enable chunking auto-detection for receipts >35 items
- Add UI toggle for "Enhanced OCR Mode"
- Collect user feedback
- Monitor cost impact

### Phase 2.3: Full Deployment (Week 3+)
- Enable chunking by default for long receipts
- Make OCR opt-in with clear benefits explained
- Add analytics dashboard to show accuracy improvements
- Document best practices for users

---

## Rollback Plan

If Phase 2 causes issues:

1. **Immediate**: Disable via environment variable
   ```
   ENABLE_RECEIPT_CHUNKING=false
   ENABLE_RECEIPT_OCR=false
   ```

2. **Code rollback**: Phase 1 code is untouched, just don't call Phase 2 functions

3. **Data**: No database changes, all Phase 2 features are processing-only

---

## Cost Analysis

### Current (Phase 1):
- Short receipts (5-15 items): $0.08-0.12
- Medium receipts (16-25 items): $0.12-0.15
- Long receipts (26-35 items): $0.15-0.18
- Very long (36+ items): $0.18-0.22

### With Phase 2 Chunking:
- Short receipts (5-15 items): $0.08-0.12 (no change)
- Medium receipts (16-25 items): $0.12-0.15 (no change)
- Long receipts (26-35 items): $0.15-0.18 (no change)
- **Very long (36+ items): $0.30-0.40** (+$0.12-0.18 for chunking)

**ROI Analysis:**
- Cost increase: ~60-80% on very long receipts
- Accuracy increase: 85% → 98% = 13% improvement
- User value: High (frustration of missing items eliminated)
- Frequency: <10% of receipts are very long
- **Verdict**: Worth it for user experience

### With Phase 2 OCR:
- Additional cost: ~$0.01-0.02 per receipt
- Time cost: +2-4 seconds processing
- Accuracy improvement: Position ±5% → ±1%
- **Verdict**: Optional feature, let users decide

---

## Success Metrics

### Quantitative:
- [ ] Capture rate >98% on 40+ item receipts (from 85%)
- [ ] Position accuracy within ±2% (from ±5%)
- [ ] Processing time <20s for chunked receipts
- [ ] <1% duplicate items from chunk overlaps
- [ ] OCR confidence >85% average

### Qualitative:
- [ ] User feedback: "Position indicators now align perfectly"
- [ ] User feedback: "No more missing items on long receipts"
- [ ] Support tickets about missing items reduced
- [ ] User adoption of OCR toggle feature

---

## Next Steps

1. ✅ Create chunking utility
2. ✅ Create OCR utility
3. ⏸️ Add opt-in API parameters
4. ⏸️ Implement chunking extraction flow
5. ⏸️ Implement OCR extraction flow
6. ⏸️ Add UI toggles for Phase 2 features
7. ⏸️ Test with real receipts
8. ⏸️ Deploy as opt-in
9. ⏸️ Collect analytics for 1 week
10. ⏸️ Decision: Full rollout or iterate

---

**Status:** Phase 2 utilities complete, integration pending
**Last Updated:** 2025-12-29
