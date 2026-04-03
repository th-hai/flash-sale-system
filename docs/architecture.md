# System Architecture

## Purchase Flow

See [purchase-flow-sequence.png](./purchase-flow-sequence.png) for the rendered diagram.

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant F as Fastify API
    participant R as Redis
    participant Q as Queue
    participant C as Consumer
    participant DB as PostgreSQL

    U->>F: POST /api/purchase {userId}
    F->>F: Check sale window (in-memory)
    alt Sale not active
        F-->>U: 403 SALE_NOT_ACTIVE
    end

    F->>R: DECR sale:stock
    alt stock < 0
        F->>R: INCR sale:stock (undo)
        F-->>U: 410 OUT_OF_STOCK
    end

    F->>R: SADD sale:purchases userId
    alt returns 0 (duplicate)
        F->>R: INCR sale:stock (undo)
        F-->>U: 409 ALREADY_PURCHASED
    end

    F->>Q: Publish order {userId} (FIFO, jobId=userId)
    F-->>U: 201 Purchase confirmed

    Q->>C: Deliver job (FIFO order)
    C->>DB: INSERT INTO orders (idempotent)
    alt Insert fails
        Note over C,Q: Exponential backoff retries
        C-->>Q: Retry 1 (wait 1s)
        C-->>Q: Retry 2 (wait 2s)
        C-->>Q: Retry 3 (wait 4s)
        C-->>Q: Retry 4 (wait 8s)
        C-->>Q: Retry 5 (wait 16s)
        Note over C,Q: All 5 retries exhausted
        C->>Q: Move to DLQ
        Q->>C: DLQ worker processes
        C->>R: INCR stock + SREM user (compensate)
    end
```

## Concurrency Control Detail

See [concurrency-flow.png](./concurrency-flow.png) for the rendered diagram.

```mermaid
graph LR
    subgraph "Step 1: Reserve Stock"
        A["DECR stock"] --> B{"stock < 0?"}
        B -->|Yes| C["INCR stock(undo)"]
        C --> D["OUT_OF_STOCK"]
    end

    subgraph "Step 2: Record User"
        B -->|No| E["SADD user"]
        E --> F{"duplicate?(returns 0)"}
        F -->|Yes| G["INCR stock(undo)"]
        G --> H["ALREADY_PURCHASED"]
        F -->|No| I["SUCCESS"]
    end
```

DECR and INCR are atomic Redis operations. SADD is also atomic and returns 0 if the member already exists, providing built-in duplicate detection.

## System Diagram


See [flash-sale-system.svg](./flash-sale-system.svg) for the full system diagram.

