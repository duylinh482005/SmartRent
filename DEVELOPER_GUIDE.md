# Developer Guide

## Tong quan

Workspace nay gom 2 app:

- `smartrent`: backend Spring Boot, JPA, Security, JWT, PDF, AI chat tuy chon
- `smartrent-fe`: frontend React, Vite, TypeScript, React Query, React Hook Form, Zustand

Luong chinh cua he thong:

`User -> Property -> Room -> Contract -> Invoice -> Payment`

`Tenant` gan voi `Contract`.

## Cau truc nhanh

- `smartrent/smartrent/src/main/java/com/smartrent/controller`: REST API
- `smartrent/smartrent/src/main/java/com/smartrent/service`: business logic
- `smartrent/smartrent/src/main/java/com/smartrent/entity`: JPA entities
- `smartrent/smartrent/src/main/resources`: profiles, app config, fonts
- `smartrent-fe/src/pages`: man hinh chinh
- `smartrent-fe/src/api`: API client
- `smartrent-fe/src/store`: auth state
- `smartrent-fe/src/components`: layout va UI dung chung

## Chay local

Backend:

```powershell
cd d:\TTCS\smartrent\smartrent
$env:SPRING_PROFILES_ACTIVE="local"
.\mvnw.cmd spring-boot:run
```

Frontend:

```powershell
cd d:\TTCS\smartrent-fe
npm run dev
```

Mac dinh frontend goi API tai `http://localhost:8080/api/v1`.

## Profile va du lieu

- Profile mac dinh trong backend dang la `mysql`
- Muon chay nhanh local thi dung `SPRING_PROFILES_ACTIVE=local`
- Muon bat AI bang OpenAI thi dung them profile `openai`
- Profile `local` dung H2 file DB tai `smartrent/smartrent_db.mv.db`
- Upload anh duoc luu trong thu muc `smartrent/uploads`

## Bat AI Assistant

OpenAI:

```powershell
cd d:\TTCS\smartrent\smartrent
$env:OPENAI_API_KEY="sk-..."
$env:SPRING_PROFILES_ACTIVE="local,openai"
.\mvnw.cmd spring-boot:run
```

Neu muon luu bien moi truong tren Windows cho cac terminal moi:

```powershell
setx OPENAI_API_KEY "sk-..."
```

Luu y:

- Khong commit API key vao `application.properties`, frontend, hoac git
- AI Assistant cua du an doc key tu bien moi truong `OPENAI_API_KEY`
- Profile `openai` dang mac dinh model `gpt-5.4-mini`

Groq:

```powershell
cd d:\TTCS\smartrent\smartrent
$env:GROQ_API_KEY="gsk_..."
$env:SPRING_PROFILES_ACTIVE="ai-groq"
.\mvnw.cmd spring-boot:run
```

Luu y:

- Chi sua `application-groq.properties` la chua du, backend phai chay voi profile `ai-groq`
- Khong can sua key trong source code
- Profile `groq` da map sang OpenAI-compatible API cua Groq
- Model mac dinh hien tai la `openai/gpt-oss-20b`

Ollama local:

```powershell
cd d:\TTCS\smartrent\smartrent
$env:SPRING_PROFILES_ACTIVE="local,ollama"
.\mvnw.cmd spring-boot:run
```

## Auth va routing

- Public API: `/api/v1/auth/**`, `/uploads/**`
- Cac API khac can JWT bearer token
- Frontend luu `token`, `username`, `role` trong `localStorage`
- Route app duoc bao boi `PrivateRoute`, neu mat token se quay ve `/login`

## Business rules can nho

- Tao contract se doi room sang `OCCUPIED`
- Terminate contract se tra room ve `AVAILABLE`
- Delete contract va invoice khong phai luc nao cung cho phep: co rule chan theo trang thai, no, hoa don, payment history
- Invoice co cron chuyen `UNPAID` sang `OVERDUE` moi ngay
- Trang `InvoicePage` va `ContractPage` chua nhieu logic UI nhat

## Diem de vap

- `PropertyPage` dang hard-code `ownerId: 1`, chua gan that voi user dang login
- CORS hien chi mo cho `http://localhost:5173` va `http://localhost:3000`
- Test backend hien rat mong, chu yeu chi co `contextLoads`
- Frontend build pass nhung bundle hien tai kha lon

## Lenh huu ich

```powershell
# Frontend build
cd d:\TTCS\smartrent-fe
npm run build

# Backend test
cd d:\TTCS\smartrent\smartrent
.\mvnw.cmd test
```

## Nen doc gi truoc khi sua code

1. `smartrent/smartrent/src/main/resources/application.properties`
2. `smartrent/smartrent/src/main/java/com/smartrent/config/SecurityConfig.java`
3. `smartrent-fe/src/api/axiosClient.ts`
4. `smartrent-fe/src/App.tsx`
5. Page ban dinh sua, dac biet la `InvoicePage.tsx` hoac `ContractPage.tsx`
