# AI Service Contract

AI service được tách thành adapter/contract trước khi chọn provider cụ thể.

## MVP responsibilities

- Parse free-text recipe thành structured suggestion.
- Trả confidence và warning cho ingredient/unit không chắc chắn.
- Hỗ trợ Copilot read-only trên authorized data projection.
- Không có credential truy cập DB trực tiếp.
- Không expose mutation tools cho model.

## Local mode

`LLM_PROVIDER=mock` để trả fixture deterministic, giúp frontend/backend test mà không cần API key.

## Security checklist

- Redact password, token, payment data và PII không cần thiết.
- Validate schema trước và sau model response.
- Timeout/retry có giới hạn.
- Lưu audit metadata, không log secret hoặc prompt chứa dữ liệu nhạy cảm.
