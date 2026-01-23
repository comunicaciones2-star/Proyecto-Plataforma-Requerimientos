# 📋 Flujo de Trabajo con Git y GitHub

## 🎯 Información del Repositorio

- **Repositorio:** https://github.com/comunicaciones2-star/Proyecto-Plataforma-Requerimientos
- **Usuario:** comunicaciones2-star
- **Email:** comunicaciones2@fenalcosantander.com.co
- **Rama Principal:** main

---

## 🚀 Comandos Básicos para el Día a Día

### 1. Verificar Estado del Proyecto
Antes de hacer cambios, verifica qué archivos han sido modificados:

```bash
cd "C:\Users\HEWLETT\Documents\2026 DISEÑOS\03 COMUNICACIONES\02 Proyecto Plataforma RD"
git status
```

### 2. Guardar Cambios Localmente (Commit)

Cuando hagas cambios importantes, guárdalos con un commit:

```bash
# Agregar todos los archivos modificados
git add .

# Crear el commit con un mensaje descriptivo
git commit -m "descripción clara del cambio"
```

### 3. Subir Cambios a GitHub (Push)

```bash
git push
```

---

## 📝 Convenciones para Mensajes de Commit

Usa prefijos para mantener un historial organizado:

- **feat:** Nueva funcionalidad
  ```bash
  git commit -m "feat: Agregar módulo de calendario"
  ```

- **fix:** Corrección de errores
  ```bash
  git commit -m "fix: Corregir error en autenticación"
  ```

- **style:** Cambios visuales (CSS, diseño)
  ```bash
  git commit -m "style: Actualizar colores del dashboard"
  ```

- **refactor:** Mejoras en el código sin cambiar funcionalidad
  ```bash
  git commit -m "refactor: Optimizar consultas a MongoDB"
  ```

- **docs:** Cambios en documentación
  ```bash
  git commit -m "docs: Actualizar README con nuevas instrucciones"
  ```

- **chore:** Tareas de mantenimiento
  ```bash
  git commit -m "chore: Actualizar dependencias"
  ```

---

## 🔄 Flujo de Trabajo Completo

### Escenario: Hiciste cambios en el dashboard

```bash
# 1. Ve al directorio del proyecto
cd "C:\Users\HEWLETT\Documents\2026 DISEÑOS\03 COMUNICACIONES\02 Proyecto Plataforma RD"

# 2. Verifica qué archivos cambiaron
git status

# 3. Agrega los archivos modificados
git add .

# 4. Crea el commit con mensaje descriptivo
git commit -m "feat: Agregar métricas de satisfacción al dashboard"

# 5. Sube los cambios a GitHub
git push
```

### Resultado
✅ Los cambios estarán disponibles en: https://github.com/comunicaciones2-star/Proyecto-Plataforma-Requerimientos

---

## 📚 Comandos Útiles Adicionales

### Ver Historial de Commits
```bash
git log --oneline -10
```

### Ver Cambios Específicos de un Archivo
```bash
git diff index.html
```

### Descartar Cambios No Guardados
```bash
# Descartar cambios en un archivo específico
git checkout -- nombre_archivo.js

# Descartar TODOS los cambios no guardados (¡CUIDADO!)
git reset --hard
```

### Ver Diferencias Antes de Commit
```bash
git diff
```

### Crear una Nueva Rama para Experimentar
```bash
git checkout -b nombre-de-rama-experimental
```

---

## ⚠️ Buenas Prácticas

1. **Haz commits frecuentes** - No esperes a tener muchos cambios
2. **Mensajes claros** - Usa los prefijos y sé específico
3. **Push regularmente** - Sube tus cambios al menos al final del día
4. **Revisa antes de commit** - Usa `git status` y `git diff`
5. **No subas archivos sensibles** - El `.gitignore` ya protege `.env`

---

## 🆘 Solución de Problemas

### Error: "Permission denied"
Si ves este error, elimina las credenciales guardadas:
```bash
cmdkey /delete:LegacyGeneric:target=git:https://github.com
```
Luego vuelve a hacer `git push` y autentica con comunicaciones2-star.

### Error: "Changes not staged"
Olvidaste hacer `git add`:
```bash
git add .
git commit -m "tu mensaje"
```

### Error: "Your branch is behind"
Alguien más hizo cambios. Descárgalos primero:
```bash
git pull
```

---

## 📅 Ejemplo de Sesión de Trabajo

```bash
# Inicio del día - Verificar estado
cd "C:\Users\HEWLETT\Documents\2026 DISEÑOS\03 COMUNICACIONES\02 Proyecto Plataforma RD"
git status

# ... trabajas en varios archivos ...

# Mediodía - Guardas progreso
git add .
git commit -m "feat: Agregar filtros por departamento"
git push

# ... sigues trabajando ...

# Fin del día - Guardas todo
git add .
git commit -m "style: Mejorar diseño de tablas en móvil"
git push
```

---

## 🎓 Recursos Adicionales

- **Ver repositorio en GitHub:** https://github.com/comunicaciones2-star/Proyecto-Plataforma-Requerimientos
- **Historial de cambios:** https://github.com/comunicaciones2-star/Proyecto-Plataforma-Requerimientos/commits/main
- **Git Cheat Sheet:** https://education.github.com/git-cheat-sheet-education.pdf

---

**Última actualización:** 23 de enero de 2026
