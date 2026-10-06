# SPRITFY 관리자 UTM 조회

`GET /api/integrations/spritfy/utm?from=YYYY-MM-DD&to=YYYY-MM-DD`

SPRITFY 관리자 서버 전용이며 사이트 ID는 `fe0f5604-5b1d-49da-8aaa-1a455fc96838`로 고정한다. 다섯 UTM 기준의 상위 50개 조회수만 기존 `getUTM`으로 읽는다. 개인 세션, 이벤트 원문, 사용자 관리, 데이터 변경을 허용하지 않는다. 기간은 한국 시간 기준 최대 93일이다.

Railway의 `UMAMI_SIGNING_PRIVATE_KEY`에 Ed25519 PKCS8 DER 형식 개인키의 base64를 저장한다. 브라우저나 Git에 개인키를 넣지 않는다. 이 저장소에는 공개 검증키만 있다. Vercel에 새 비밀값이나 데이터베이스 변경은 필요 없다.

요청 헤더 `X-Spritfy-Timestamp`는 밀리초 Unix 시간, `X-Spritfy-Signature`는 `spritfy-utm-v1\n<timestamp>\n<from>\n<to>` UTF-8 메시지의 Ed25519 서명(base64url, 패딩 없음)이다. 최대 5분 전·1분 미래의 요청만 허용한다. 응답은 private/no-store이며, 서버 오류 상세는 노출하지 않는다.

개인키를 교체할 때 새 공개키를 `src/lib/spritfy-analytics.mjs`에 커밋·배포하고 Railway 개인키도 함께 교체한다. 공개키를 바꾸면 기존 키는 접근할 수 없다.

검증: `node scripts/spritfy-analytics-test.mjs`. 기존 `pnpm-lock.yaml` 로컬 변경은 이 기능과 별개다.
