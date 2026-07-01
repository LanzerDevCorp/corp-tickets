# Arquitectura del Sistema — Corp Tickets

Este documento describe la arquitectura de **Corp Tickets**, un sistema minimalista de gestión de tickets de soporte técnico. Está diseñado para ser comprensible tanto para personas sin perfil técnico como para desarrolladores que deseen entender el funcionamiento del sistema a alto nivel.

Para lograr esto, la documentación está dividida en niveles inspirados en el **Modelo C4** de arquitectura de software, enfocándose principalmente en el contexto general y los componentes principales del sistema.

---

## Capa 1: Contexto del Sistema (¿Quién usa el sistema y con qué interactúa?)

Esta capa representa la vista de más alto nivel. Imagina que el sistema es una "caja negra" y queremos ver cómo se relaciona con las personas y otros servicios externos.

```mermaid
graph LR
    %% Definición de Estilos (Negro con letras blancas)
    classDef client fill:#222222,stroke:#444444,stroke-width:2px,color:#ffffff,stroke-dasharray: 5 5;
    classDef staff fill:#222222,stroke:#444444,stroke-width:2px,color:#ffffff;
    classDef system fill:#111111,stroke:#000000,stroke-width:3px,color:#ffffff;
    classDef external fill:#333333,stroke:#555555,stroke-width:2px,color:#ffffff;

    %% Nodos
    Client["👤 **Clientes**<br/>(Cualquier usuario)<br/>_Envían tickets de soporte y hacen seguimiento a sus respuestas_"]:::client

    Staff["👨‍💻 **Personal de IT y Admins**<br/>(Empleados internos)<br/>_Gestionan, responden y resuelven los tickets de soporte_"]:::staff

    System["💻 **Sistema Corp Tickets**<br/>_Aplicación Web Central_<br/>(El software desarrollado que centraliza todo el servicio)"]:::system

    Turnstile["🛡️ **Cloudflare Turnstile**<br/>_Seguridad Anti-bots_<br/>(Protege el formulario evitando que robots envíen spam)"]:::external

    Resend["📧 **Resend / Correo**<br/>_Notificaciones por Email_<br/>(Envía avisos de nuevos comentarios y enlaces mágicos)"]:::external

    %% Flujos de interacción
    Client -->|1. Envía ticket e interactúa| System
    Client -->|2. Resuelve verificación| Turnstile

    Staff -->|3. Atiende y resuelve tickets| System

    System -->|4. Envía alertas de correo| Resend
    Resend -.->|5. Recibe notificaciones| Client
    Resend -.->|5. Recibe alertas de cola| Staff
```

### Explicación Sencilla de los Actores:

- **Clientes:** Son usuarios (internos de la empresa o clientes externos) que experimentan un problema técnico. Pueden crear un ticket de soporte de forma pública sin tener una cuenta previa y realizar el seguimiento mediante un enlace seguro enviado a su correo.
- **Personal de IT y Administradores:** Son los miembros del equipo que resuelven los incidentes. Tienen un panel privado donde ven todos los tickets, los asignan, agregan comentarios públicos o notas internas, y configuran las categorías de atención.
- **Cloudflare Turnstile:** Es un guardián silencioso. Cuando alguien envía un ticket público, Turnstile verifica en segundos que sea un humano y no un script automatizado dañino.
- **Resend:** Es el encargado del correo. Cada vez que pasa algo importante (se crea un ticket, se responde o se cierra), este servicio se asegura de que le llegue la notificación por correo al cliente o al personal de IT asignado.

---

## Capa 2: Contenedores (¿De qué partes está hecho el sistema?)

Si abrimos la "caja negra" del **Sistema Corp Tickets**, nos encontramos con los contenedores. Un contenedor es una parte del software que ejecuta código o almacena información.

```mermaid
graph TD
    %% Estilos (Negro con letras blancas)
    classDef browser fill:#222222,stroke:#444444,stroke-width:2px,color:#ffffff;
    classDef nextjs fill:#111111,stroke:#000000,stroke-width:2px,color:#ffffff;
    classDef db fill:#222222,stroke:#444444,stroke-width:2px,color:#ffffff;
    classDef storage fill:#222222,stroke:#444444,stroke-width:2px,color:#ffffff;
    classDef external fill:#333333,stroke:#555555,stroke-width:2px,color:#ffffff;

    %% Actores
    User["👤 **Usuario**<br/>(Cliente o Personal de IT)"]:::browser

    subgraph SystemBoundary ["💻 Límite del Sistema Corp Tickets"]
        App["🌐 **Aplicación Web (Next.js)**<br/>_React, Javascript & Server Actions_<br/>Es la parte visual del sistema que corre en el navegador del usuario y el servidor que procesa las solicitudes, ejecuta las reglas del negocio y conecta todo._"]:::nextjs

        DB["🗄️ **Base de Datos**<br/>_Supabase PostgreSQL_<br/>Guarda toda la información escrita del sistema: tickets, categorías, comentarios, perfiles de usuario y logs de lectura de forma segura y estructurada._"]:::db

        Files["📦 **Almacenamiento de Archivos**<br/>_Supabase Storage_<br/>Es el casillero virtual donde se guardan físicamente los archivos adjuntos (documentos PDF, imágenes de error) subidos en los tickets._"]:::storage
    end

    %% Servicios Externos
    Turnstile["🛡️ **Cloudflare Turnstile**<br/>(Seguridad)"]:::external
    Resend["📧 **Resend**<br/>(Notificaciones)"]:::external

    %% Flujos de interacción
    User -->|1. Interactúa con la pantalla| App
    App -->|2. Valida envío seguro| Turnstile
    App -->|3. Lee/escribe información estructurada| DB
    App -->|4. Guarda y recupera archivos adjuntos| Files
    App -->|5. Envía solicitudes de notificación| Resend
```

### Detalle de los Contenedores:

1.  **Aplicación Web (Next.js):**
    - _¿Qué hace?_ Renderiza las páginas que los usuarios ven en su pantalla (el formulario público, el dashboard de IT, etc.). También actúa como el servidor de aplicación, encargándose de recibir datos, validar formularios (con la librería `zod`), y procesar los cambios de estado del ticket de forma segura.
    - _Tecnología:_ Next.js App Router (Javascript/TypeScript).
2.  **Base de Datos (Supabase PostgreSQL):**
    - _¿Qué hace?_ Es el cerebro del almacenamiento. Guarda la información en tablas estructuradas y relacionadas entre sí (quién creó el ticket, qué comentarios tiene, qué agente de IT está asignado).
    - _Seguridad Clave (RLS):_ Cuenta con **Row Level Security (RLS)**, lo que significa que la propia base de datos impide que un cliente chismoso intente leer los tickets de otra persona, incluso si la aplicación web tuviera un error de programación.
3.  **Almacenamiento de Archivos (Supabase Storage):**
    - _¿Qué hace?_ Las bases de datos no son buenas guardando archivos grandes como imágenes o PDFs de 10 MB. Para eso existe este contenedor: un disco duro virtual optimizado para servir archivos adjuntos rápidamente.

---

## Detalles de Implementación Técnica (Para Desarrolladores)

Si eres programador y necesitas saber exactamente cómo se implementa esto en el código, aquí tienes las capas de bajo nivel:

### 1. Organización del Enrutamiento (Route Groups en Next.js)

El frontend organiza las pantallas mediante grupos de rutas que encapsulan la lógica de acceso:

- `app/(public)/`: Páginas de acceso libre (formulario de creación de tickets).
- `app/(public-access)/`: Páginas para iniciar sesión de clientes o solicitar accesos de seguimiento.
- `app/(tracking)/`: Panel de seguimiento del cliente (`/track` y `/track/[ticketId]`). Si un usuario sin sesión intenta entrar, es redirigido mediante lógica del servidor a `/portal`.
- `app/(staff)/`: Panel privado del personal técnico e IT (`/dashboard` y `/admin`). Requiere autenticación y que el rol del usuario sea `admin` o `it`.

### 2. Modelo de Datos (Diagrama Entidad-Relación)

A nivel de base de datos PostgreSQL, la estructura está normalizada de la siguiente manera:

```mermaid
erDiagram
    users {
        uuid id PK "auth.users(id)"
        text role "admin, it, client"
        text email "Único"
        text display_name
        timestamptz created_at
    }

    categories {
        uuid id PK
        text name "Único"
        boolean is_enabled
        timestamptz created_at
    }

    tickets {
        uuid id PK
        text name
        text email
        text subject
        text body
        text priority "low, medium, high, urgent"
        uuid category_id FK "categories(id)"
        text status "open, in_progress, resolved, closed"
        uuid assigned_to FK "users(id)"
        text closure_reason
        timestamptz created_at
        timestamptz updated_at
        timestamptz resolved_at
    }

    comments {
        uuid id PK
        uuid ticket_id FK "tickets(id)"
        uuid author_id FK "users(id)"
        text body
        boolean is_internal
        text_array cc_emails
        timestamptz created_at
    }

    ticket_attachments {
        uuid id PK
        uuid ticket_id FK "tickets(id)"
        text storage_path
        text filename
        text mime_type
        bigint size_bytes
        uuid uploaded_by FK "users(id)"
        timestamptz created_at
        timestamptz deleted_at
        text deleted_by
    }

    ticket_views {
        uuid user_id PK "users(id)"
        uuid ticket_id PK "tickets(id)"
        timestamptz last_viewed_at
    }

    users ||--o{ tickets : "se le asigna"
    categories ||--o{ tickets : "clasifica"
    tickets ||--o{ comments : "contiene"
    users ||--o{ comments : "escribe"
    tickets ||--o{ ticket_attachments : "contiene"
    users ||--o| ticket_views : "registra lectura"
    tickets ||--o| ticket_views : "es visto por"
```

### 3. Flujo de Control de Acceso (RLS)

La autorización se valida en dos capas:

1.  **Capa Web (Next.js):** El archivo `proxy.ts` (en la raíz) y los layouts correspondientes interceptan las peticiones para verificar si el usuario tiene una sesión activa y redirigir si no está autorizado.
2.  **Capa Base de Datos (Supabase RLS):** Aunque alguien intente consultar la base de datos de manera directa omitiendo la aplicación web, PostgreSQL rechaza la petición si el rol del usuario decodificado en el JWT no tiene permisos. Por ejemplo:
    - Los clientes solo pueden consultar tickets donde el campo `email` coincida con su token de sesión (`auth.jwt() ->> 'email'`).
    - Los comentarios marcados como `is_internal = true` no se exponen a clientes a nivel de base de datos mediante políticas RLS.
    - La tabla `ticket_attachments` posee una política de denegación total por defecto ("deny-all"), lo que significa que el frontend debe interactuar con ella mediante **Next.js Server Actions** que operen bajo privilegios administrativos (`service_role`). Esto asegura que las validaciones de negocio (tamaño de archivo, tipos permitidos) siempre se ejecuten en el servidor antes de insertar filas en la base de datos.
