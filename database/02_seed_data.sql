USE GestionReparacionIT;
GO

INSERT INTO ROLES (nombre, descripcion) VALUES
('Admin IT',    'Administrador del sistema con acceso global'),
('Técnico IT',  'Técnico de soporte operativo'),
('Solicitante', 'Usuario final en tienda o departamento');
GO

-- Permisos base por módulo (amplía esta lista según la matriz de la sección 5.2)
INSERT INTO PERMISOS (codigo, descripcion, modulo) VALUES
('tiendas.crear',            'Crear tiendas',                       'Organizacional'),
('tiendas.leer',             'Consultar tiendas',                   'Organizacional'),
('usuarios.administrar',     'CRUD completo de usuarios',           'Seguridad'),
('reparaciones.crear',       'Registrar reparaciones',              'Reparaciones'),
('reparaciones.asignar',     'Asignar técnico a una reparación',    'Reparaciones'),
('reparaciones.cambiar_estado', 'Cambiar estado de una reparación', 'Reparaciones'),
('inventario.administrar',   'CRUD de consumibles e inventario',    'Inventario'),
('alertas.gestionar',        'Ver y resolver alertas',              'Inventario'),
('reportes.ver',             'Ver reportes y tableros',              'Reportes');
GO

-- Ejemplo de asociación rol-permiso para 'Admin IT' (rol_id = 1): todos los permisos
INSERT INTO ROL_PERMISO (rol_id, permiso_id)
SELECT 1, id FROM PERMISOS;
GO

-- Las 14 tiendas (ejemplo de estructura; reemplaza con los datos reales de la empresa — RF-13)
INSERT INTO TIENDAS (codigo, nombre, departamento_geo) VALUES
('T01','Tienda 01','Ejemplo'), ('T02','Tienda 02','Ejemplo'), ('T03','Tienda 03','Ejemplo'),
('T04','Tienda 04','Ejemplo'), ('T05','Tienda 05','Ejemplo'), ('T06','Tienda 06','Ejemplo'),
('T07','Tienda 07','Ejemplo'), ('T08','Tienda 08','Ejemplo'), ('T09','Tienda 09','Ejemplo'),
('T10','Tienda 10','Ejemplo'), ('T11','Tienda 11','Ejemplo'), ('T12','Tienda 12','Ejemplo'),
('T13','Tienda 13','Ejemplo'), ('T14','Tienda 14','Ejemplo');
GO

-- Códigos de consumibles de ejemplo (sección 11.3)
INSERT INTO CONSUMIBLES (codigo, descripcion, tipo, color) VALUES
('TON-HP-05A',        'Tóner HP 05A alto rendimiento', 'TONER', 'NEGRO'),
('TIN-EP-T504120-K',  'Tinta Epson T504120 Negro',     'TINTA', 'NEGRO'),
('TIN-EP-T504220-C',  'Tinta Epson T504220 Cian',      'TINTA', 'CIAN'),
('CUB-POS-80MM',      'Rollo térmico 80mm POS',        'ROLLO_TERMICO', 'NEGRO'),
('CIN-RBN-ZEB-110MM', 'Cinta impresora Zebra 110mm',   'CINTA', 'NEGRO');
GO