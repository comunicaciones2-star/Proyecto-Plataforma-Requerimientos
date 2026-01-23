// routes/departmentRoutes.js
const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const { authenticate, authorize } = require('../middleware/auth');

// Solo admin puede gestionar departamentos
router.use(authenticate);
router.use(authorize(['admin']));

// Obtener todos los departamentos
router.get('/', async (req, res) => {
  try {
    const departments = await Department.find({ active: true })
      .sort({ name: 1 })
      .populate('createdBy', 'firstName lastName');
    
    res.json({
      success: true,
      departments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener departamentos',
      error: error.message
    });
  }
});

// Crear nuevo departamento
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const department = new Department({
      name,
      description,
      createdBy: req.user.userId
    });
    
    await department.save();
    
    res.status(201).json({
      success: true,
      message: 'Departamento creado exitosamente',
      department
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error al crear departamento',
      error: error.message
    });
  }
});

// Actualizar departamento
router.patch('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true, runValidators: true }
    );
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Departamento no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Departamento actualizado exitosamente',
      department
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error al actualizar departamento',
      error: error.message
    });
  }
});

// Desactivar departamento (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Departamento no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Departamento eliminado exitosamente'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error al eliminar departamento',
      error: error.message
    });
  }
});

module.exports = router;
