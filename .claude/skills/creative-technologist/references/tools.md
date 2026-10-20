# Tools: mechanics, costs, gotchas

Prices are what we saw in October 2026; re-check with the cost tools before batching.

## OpenArt (MCP tools `openart_*`)

1. `openart_account_get`: plan and credits. **Free plans watermark output** with a large logo, so don't ship free-plan images. The connector account can change if someone reconnects it; check every session.
2. `openart_model_list`: which models and modes the balance covers. `openart_model_cost` prices one config.
3. Upload a reference (headless/CLI): `openart_upload_sign` (mediaType image, exact byte size, contentType), then `curl -X PUT -H 'Content-Type: image/jpeg' --data-binary @file "<signURL>"`, then `openart_upload_metadata_get` with the `accessURL` and `uploadId`. Pass the returned `visualReference` object in `params.visualReferences`.
4. `openart_model_form_get(model, mode)` for the exact params, then `openart_generate_image` / `openart_generate_video`.
5. Poll `openart_creation_get(historyId)` until COMPLETED, then download `resources[].url` right away.

Image models for people and places (image2image credits per image): `nano-banana-pro` 40 (best for people, multi-subject, 4K), `gpt-image-2-5-sunburst` 42 (precise edits), `nano-banana-2` 20, `byte-plus-seedream-5-pro` 30, `kling-3-omni` 10 (cheap, weaker fidelity, invents elements).
Video (image2video): `veo3-1` 120+ (lite tier; "fast"/"normal" cost more), `kling-v3` 175, `byte-plus-seedance-2` 400, `pixverseV6` 50.

## ElevenLabs Creative (MCP tools `creative_*`)

1. `creative_create_flow` once; reuse its `flow_id` for everything.
2. Upload: `creative_create_asset_upload` (name, mime, exact size), PUT the bytes to `upload_url`, then `creative_finalize_asset_upload` with `flow_id` to get a `node_id`.
3. `creative_edit_image` with `connect_from:[node_id]`, `model_id: gpt-image-2.5-sunburst`, 4 variations by default. Pass `estimate_only:true` first to price it (about 433 credits per image at 1K high quality).
4. Poll `creative_get_flow_run_status` with all session_ids. Large results get written to a file; parse it with Python and download `content_url` for each completed generation. **Signed URLs expire in about 2 hours.**
5. **Plans have a hard credit cap** (we hit a 10,000 cap mid-batch). Calls past the cap fail before generating and aren't charged; report which views are missing.

## What we learned on a real run (OpenArt Starter plan)
- `gpt-image-2-5-sunburst` image2image at `resolutionTier: 2k`, `quality: high` costs **172 credits** per image (much more than the default-config price in the list). Price the exact config with `openart_model_cost` first.
- About 8–9 generations can run at once; more fail with `PARALLEL_LIMIT_EXCEEDED` and are **not charged**. Resubmit once some finish.
- Bake-off result for "add real people to this frame": GPT Image 2.5 kept the exact framing and gave candid, documentary people. Nano Banana Pro gave larger, more posed people and moved the camera. Use GPT 2.5 for plates that must line up with the site, and Nano Banana Pro for people lineups and cutouts.
- Output URLs on `cdn.openart.ai` are plain (unsigned) on paid plans; download them anyway.

## Which to use
- **Bake-off first:** one view, two or three models, the same prompt; pick by people quality and framing fidelity.
- **ElevenLabs gpt-image-2.5-sunburst:** best at holding the exact layout of a reference.
- **OpenArt nano-banana-pro:** strongest at believable crowds and faces.
- **Kling 3 Omni:** fine for cheap exploration but drifts from the reference.
