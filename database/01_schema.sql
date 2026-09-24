-- =====================================================================
-- Sistema de Gestión de Reparación IT v1.0 — Script de creación
-- Motor: Microsoft SQL Server 2019+ / Azure SQL Database
-- =====================================================================

CREATE DATABASE GestionReparacionIT;
GO
USE GestionReparacionIT;
GO

-- ============================================================
-- MÓDULO 1: ORGANIZACIONAL Y SEGURIDAD
-- ============================================================

CREATE TABLE TIENDAS (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    codigo            VARCHAR(10)  NOT NULL UNIQUE,
    nombre            VARCHAR(100) NOT NULL,
    departamento_geo  VARCHAR(50)  NOT NULL,
    direccion         VARCHAR(200) NULL,
    telefono          VARCHAR(20)  NULL,
    activo            BIT NOT NULL DEFAULT 1
);

CREATE TABLE DEPARTAMENTOS_OFICINA (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    tienda_id   INT NOT NULL,
    nombre      VARCHAR(100) NOT NULL,
    activo      BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_depto_tienda FOREIGN KEY (tienda_id) REFERENCES TIENDAS(id)
);

CREATE TABLE AREAS (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    departamento_id  INT NOT NULL,
    nombre           VARCHAR(100) NOT NULL,
    activo           BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_area_depto FOREIGN KEY (departamento_id) REFERENCES DEPARTAMENTOS_OFICINA(id)
);

CREATE TABLE ROLES (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    nombre       VARCHAR(40)  NOT NULL UNIQUE, -- 'Admin IT', 'Técnico IT', 'Solicitante'
    descripcion  VARCHAR(150) NULL
);

CREATE TABLE PERMISOS (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    codigo       VARCHAR(60)  NOT NULL UNIQUE, -- ej. 'reparaciones.asignar'
    descripcion  VARCHAR(150) NOT NULL,
    modulo       VARCHAR(60)  NOT NULL
);

CREATE TABLE ROL_PERMISO (
    rol_id     INT NOT NULL,
    permiso_id INT NOT NULL,
    CONSTRAINT PK_rol_permiso PRIMARY KEY (rol_id, permiso_id),
    CONSTRAINT FK_rp_rol     FOREIGN KEY (rol_id)     REFERENCES ROLES(id),
    CONSTRAINT FK_rp_permiso FOREIGN KEY (permiso_id) REFERENCES PERMISOS(id)
);

CREATE TABLE USUARIOS (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    nombre_completo   VARCHAR(120) NOT NULL,
    email             VARCHAR(120) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,      -- salida de Argon2id, nunca texto plano
    rol_id            INT NOT NULL,
    tienda_id         INT NULL,
    area_id           INT NULL,
    activo            BIT NOT NULL DEFAULT 1,       -- baja lógica, nunca DELETE físico
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta   DATETIME2 NULL,
    fecha_creacion    DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_usr_rol     FOREIGN KEY (rol_id)     REFERENCES ROLES(id),
    CONSTRAINT FK_usr_tienda  FOREIGN KEY (tienda_id)  REFERENCES TIENDAS(id),
    CONSTRAINT FK_usr_area    FOREIGN KEY (area_id)    REFERENCES AREAS(id)
);

CREATE TABLE AUDITORIA (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id          INT NULL,                     -- NULL permitido: ej. intentos de login fallidos de usuario inexistente
    accion              VARCHAR(40)  NOT NULL,         -- 'CREAR','MODIFICAR','ELIMINAR','LOGIN','LOGIN_FALLIDO'
    entidad             VARCHAR(60)  NOT NULL,
    entidad_id          INT NULL,
    valores_anteriores  NVARCHAR(MAX) NULL,            -- JSON serializado
    valores_nuevos      NVARCHAR(MAX) NULL,            -- JSON serializado
    fecha               DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_aud_usr FOREIGN KEY (usuario_id) REFERENCES USUARIOS(id)
);

-- ============================================================
-- MÓDULO 2: INVENTARIO DE EQUIPOS
-- ============================================================

CREATE TABLE EQUIPOS (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    codigo_interno   VARCHAR(20)  NOT NULL UNIQUE,
    nombre           VARCHAR(100) NOT NULL,
    tipo             VARCHAR(30)  NOT NULL CHECK (tipo IN (
                        'CPU', 'LAPTOP', 'IMPRESORA_NORMAL', 'IMPRESORA_CAJA',
                        'IMPRESORA_ETIQUETAS', 'RELOJ_MARCADOR'
                     )),
    marca            VARCHAR(60)  NULL,
    modelo           VARCHAR(60)  NULL,
    serie            VARCHAR(80)  NOT NULL UNIQUE,
    estado_actual    VARCHAR(20)  NOT NULL DEFAULT 'OPERATIVO'
                        CHECK (estado_actual IN ('OPERATIVO','EN_TALLER','BAJA')),
    tienda_id        INT NOT NULL,
    departamento_id  INT NULL,
    area_id          INT NULL,
    propietario_id   INT NULL,
    fecha_alta       DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_eq_tienda FOREIGN KEY (tienda_id)       REFERENCES TIENDAS(id),
    CONSTRAINT FK_eq_depto  FOREIGN KEY (departamento_id) REFERENCES DEPARTAMENTOS_OFICINA(id),
    CONSTRAINT FK_eq_area   FOREIGN KEY (area_id)         REFERENCES AREAS(id),
    CONSTRAINT FK_eq_prop   FOREIGN KEY (propietario_id)  REFERENCES USUARIOS(id)
);

CREATE TABLE IMPRESORAS (
    equipo_id   INT PRIMARY KEY,
    tecnologia  VARCHAR(20) NOT NULL CHECK (tecnologia IN ('LASER','INYECCION','TERMICA')),
    es_color    BIT NOT NULL DEFAULT 0,
    CONSTRAINT FK_imp_equipo FOREIGN KEY (equipo_id) REFERENCES EQUIPOS(id) ON DELETE CASCADE
);

-- ============================================================
-- MÓDULO 3: CICLO DE REPARACIÓN
-- ============================================================

CREATE TABLE PROVEEDORES (
    id        INT IDENTITY(1,1) PRIMARY KEY,
    nombre    VARCHAR(120) NOT NULL,
    contacto  VARCHAR(120) NULL,
    telefono  VARCHAR(20)  NULL,
    activo    BIT NOT NULL DEFAULT 1
);

CREATE TABLE REPUESTOS (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    codigo         VARCHAR(30)  NOT NULL UNIQUE,
    nombre         VARCHAR(120) NOT NULL,
    tienda_id      INT NOT NULL,
    proveedor_id   INT NULL,
    stock_actual   INT NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    costo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
    CONSTRAINT FK_rep_tienda    FOREIGN KEY (tienda_id)    REFERENCES TIENDAS(id),
    CONSTRAINT FK_rep_proveedor FOREIGN KEY (proveedor_id) REFERENCES PROVEEDORES(id)
);

CREATE TABLE REPARACIONES (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    folio           VARCHAR(20)  NOT NULL UNIQUE,
    equipo_id       INT NOT NULL,
    solicitante_id  INT NOT NULL,
    tecnico_id      INT NULL,
    prioridad       VARCHAR(10) NOT NULL DEFAULT 'MEDIA'
                        CHECK (prioridad IN ('BAJA','MEDIA','ALTA','CRITICA')),
    estado          VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO' CHECK (estado IN (
                        'REGISTRADO','EN_REVISION','EN_REPARACION','ESPERA_REPUESTO',
                        'REPARADO','EN_CAMINO','ENTREGADO','DESCARTADO','CANCELADO'
                    )),
    fecha_registro  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_cierre    DATETIME2 NULL,
    CONSTRAINT FK_rep_equipo FOREIGN KEY (equipo_id)      REFERENCES EQUIPOS(id),
    CONSTRAINT FK_rep_solic  FOREIGN KEY (solicitante_id) REFERENCES USUARIOS(id),
    CONSTRAINT FK_rep_tec    FOREIGN KEY (tecnico_id)     REFERENCES USUARIOS(id)
);

-- Pantalla 1: Formato de Ingreso
CREATE TABLE FORMATO_INGRESO (
    id                        INT IDENTITY(1,1) PRIMARY KEY,
    reparacion_id             INT NOT NULL UNIQUE,
    falla_reportada           NVARCHAR(MAX) NOT NULL,
    accesorios_incluidos      VARCHAR(255) NULL,
    estado_fisico_recepcion   VARCHAR(255) NOT NULL,
    fecha_ingreso             DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_fi_rep FOREIGN KEY (reparacion_id) REFERENCES REPARACIONES(id) ON DELETE CASCADE
);

-- Pantalla 2: Formato de Salida
CREATE TABLE FORMATO_SALIDA (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    reparacion_id           INT NOT NULL UNIQUE,
    diagnostico_tecnico     NVARCHAR(MAX) NOT NULL,
    trabajo_realizado       NVARCHAR(MAX) NOT NULL,
    pruebas_conformidad_ok  BIT NOT NULL DEFAULT 1,
    observaciones_garantia  VARCHAR(255) NULL,
    fecha_salida            DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_fs_rep FOREIGN KEY (reparacion_id) REFERENCES REPARACIONES(id) ON DELETE CASCADE
);

CREATE TABLE HISTORIAL_ESTADOS (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    reparacion_id    INT NOT NULL,
    usuario_id       INT NOT NULL,
    estado_anterior  VARCHAR(20) NULL,
    estado_nuevo     VARCHAR(20) NOT NULL,
    fecha            DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    comentario       VARCHAR(255) NULL,
    CONSTRAINT FK_hist_rep FOREIGN KEY (reparacion_id) REFERENCES REPARACIONES(id) ON DELETE CASCADE,
    CONSTRAINT FK_hist_usr FOREIGN KEY (usuario_id)    REFERENCES USUARIOS(id)
);

CREATE TABLE REPARACION_REPUESTO (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    reparacion_id   INT NOT NULL,
    repuesto_id     INT NOT NULL,
    cantidad        INT NOT NULL CHECK (cantidad > 0),
    costo_unitario  DECIMAL(10,2) NOT NULL CHECK (costo_unitario >= 0), -- copiado al momento del consumo (valor histórico)
    CONSTRAINT FK_rr_rep      FOREIGN KEY (reparacion_id) REFERENCES REPARACIONES(id) ON DELETE CASCADE,
    CONSTRAINT FK_rr_repuesto FOREIGN KEY (repuesto_id)   REFERENCES REPUESTOS(id)
);

-- ============================================================
-- MÓDULO 4: CONSUMIBLES, IMPRESORAS Y ALERTAS
-- ============================================================

CREATE TABLE CONSUMIBLES (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    codigo       VARCHAR(30)  NOT NULL UNIQUE,
    descripcion  VARCHAR(120) NOT NULL,
    tipo         VARCHAR(20)  NOT NULL CHECK (tipo IN ('TINTA','TONER','CINTA','ROLLO_TERMICO')),
    color        VARCHAR(15)  NOT NULL DEFAULT 'NEGRO'
);

CREATE TABLE COMPATIBILIDAD_CONSUMIBLE (
    consumible_id  INT NOT NULL,
    impresora_id   INT NOT NULL, -- FK a IMPRESORAS.equipo_id
    CONSTRAINT PK_compat PRIMARY KEY (consumible_id, impresora_id),
    CONSTRAINT FK_compat_cons FOREIGN KEY (consumible_id) REFERENCES CONSUMIBLES(id),
    CONSTRAINT FK_compat_imp  FOREIGN KEY (impresora_id)  REFERENCES IMPRESORAS(equipo_id)
);

CREATE TABLE INVENTARIO_CONSUMIBLE (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    consumible_id  INT NOT NULL,
    tienda_id      INT NOT NULL,
    stock_actual   INT NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo   INT NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    CONSTRAINT UQ_inv_tienda UNIQUE (consumible_id, tienda_id),
    CONSTRAINT FK_inv_cons   FOREIGN KEY (consumible_id) REFERENCES CONSUMIBLES(id),
    CONSTRAINT FK_inv_tienda FOREIGN KEY (tienda_id)     REFERENCES TIENDAS(id)
);

CREATE TABLE MOVIMIENTOS_CONSUMIBLE (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    inventario_id  INT NOT NULL,
    impresora_id   INT NULL,
    usuario_id     INT NOT NULL,
    proveedor_id   INT NULL,
    tipo           VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA','AJUSTE')),
    cantidad       INT NOT NULL CHECK (cantidad > 0),
    fecha          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_mov_inv   FOREIGN KEY (inventario_id) REFERENCES INVENTARIO_CONSUMIBLE(id),
    CONSTRAINT FK_mov_imp   FOREIGN KEY (impresora_id)  REFERENCES IMPRESORAS(equipo_id),
    CONSTRAINT FK_mov_usr   FOREIGN KEY (usuario_id)    REFERENCES USUARIOS(id),
    CONSTRAINT FK_mov_prov  FOREIGN KEY (proveedor_id)  REFERENCES PROVEEDORES(id)
);

CREATE TABLE SOLICITUDES_INSUMO (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    tienda_id             INT NOT NULL,
    consumible_id         INT NOT NULL,
    solicitante_id        INT NOT NULL,
    cantidad_solicitada   INT NOT NULL CHECK (cantidad_solicitada > 0),
    estado                VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE'
                            CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA','ENTREGADA')),
    fecha_solicitud       DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_resolucion      DATETIME2 NULL,
    CONSTRAINT FK_sol_tienda FOREIGN KEY (tienda_id)      REFERENCES TIENDAS(id),
    CONSTRAINT FK_sol_cons   FOREIGN KEY (consumible_id)  REFERENCES CONSUMIBLES(id),
    CONSTRAINT FK_sol_usr    FOREIGN KEY (solicitante_id) REFERENCES USUARIOS(id)
);

CREATE TABLE ALERTAS (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    tipo                VARCHAR(20)  NOT NULL, -- 'STOCK_MINIMO','SLA_VENCIDO', etc.
    mensaje             VARCHAR(255) NOT NULL,
    usuario_destino_id  INT NOT NULL,
    leida               BIT NOT NULL DEFAULT 0,
    fecha_generada      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_resuelta      DATETIME2 NULL,
    CONSTRAINT FK_ale_usr FOREIGN KEY (usuario_destino_id) REFERENCES USUARIOS(id)
);
GO

-- ============================================================
-- ÍNDICES DE RENDIMIENTO (Sección 8.6 del informe)
-- ============================================================

CREATE INDEX IX_equipos_tienda        ON EQUIPOS(tienda_id);
CREATE INDEX IX_reparaciones_estado   ON REPARACIONES(estado, fecha_registro);
CREATE INDEX IX_historial_rep_fecha   ON HISTORIAL_ESTADOS(reparacion_id, fecha);
CREATE INDEX IX_movimientos_inv_fecha ON MOVIMIENTOS_CONSUMIBLE(inventario_id, fecha);
CREATE INDEX IX_usuarios_tienda       ON USUARIOS(tienda_id);
GO

-- ============================================================
-- TRIGGER: HISTORIAL_ESTADOS es de solo inserción (refuerza RF-06)
-- ============================================================

CREATE TRIGGER TRG_historial_solo_insercion
ON HISTORIAL_ESTADOS
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR('HISTORIAL_ESTADOS es de solo lectura una vez insertado. No se permite UPDATE ni DELETE.', 16, 1);
    ROLLBACK TRANSACTION;
END;
GO