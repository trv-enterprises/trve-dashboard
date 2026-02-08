# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server cmd/server/main.go

# Runtime stage
FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /build/server .
COPY --from=builder /build/config ./config
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost:3001/health || exit 1
CMD ["./server"]
