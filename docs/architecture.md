# Архитектура

Браузер ходит в nginx. Nginx отдаёт собранный клиент и проксирует `/api`, `/docs` и `/openapi.json` на FastAPI. FastAPI читает и пишет PostgreSQL.

```mermaid
flowchart LR
  browser[Браузер] --> nginx[nginx]
  nginx --> api[FastAPI]
  api --> db[(PostgreSQL)]
```

Vercel и Render — сдача практики, а Compose — тот же контур на своём сервере.

## Таблицы

Пять таблиц. Каталожный табак — `tobaccos.owner_id IS NULL`. Свой — с `owner_id`. Вкусы живут отдельно, чтобы у одного табака было несколько меток.

```mermaid
erDiagram
  users ||--o{ tobaccos : owns
  users ||--o{ mixes : saves
  tobaccos ||--o{ tobacco_flavors : has
  mixes ||--o{ mix_items : contains
  tobaccos ||--o{ mix_items : used_in

  users {
    int id PK
    string login
    string password_hash
    string role
  }
  tobaccos {
    int id PK
    string brand
    string name
    string strength
    int owner_id FK
    bool retired
  }
  tobacco_flavors {
    int id PK
    int tobacco_id FK
    string flavor
  }
  mixes {
    int id PK
    int user_id FK
    string mode
    int size
    text note
    int rating
    datetime created_at
  }
  mix_items {
    int id PK
    int mix_id FK
    int tobacco_id FK
    int position
  }
```

## Сценарии

### Спин гостя

1. Открыть сайт без входа.
2. Выбрать размер и режим, при желании бренд, вкус или крепость.
3. Крутить рулетку: API берёт только общий каталог и не пишет смесь.
4. Посмотреть набор. Сохранить нельзя.

### Сохранение смеси

1. Войти.
2. Крутить рулетку (каталог, полка или оба).
3. Сохранить набор: API пишет `mixes` и `mix_items`.
4. В кабинете открыть историю, поставить заметку и оценку.

### Своя полка

1. Войти и открыть кабинет.
2. Добавить свой табак: бренд, название, крепость, вкусы.
3. Править или убрать позицию. Если табак уже в смеси, он помечается `retired`, а не удаляется.
4. Крутить рулетку с источником «полка» или «оба».

### Очистка и заливка каталога

1. Войти как администратор и открыть админку.
2. Очистить каталог: общие табаки получают `retired`.
3. Залить CSV: известные пары бренд+название обновляются и снимаются с `retired`, новые добавляются.
4. Рулетка гостя снова видит актуальный каталог.
