const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { allowRoles } = require('../middleware/roles');
const { createCouponValidation } = require('../utils/validators');
const {
  getPublicOffers,
  getManagedCoupons,
  createManagedCoupon,
  updateManagedCoupon,
  deleteManagedCoupon,
} = require('../controllers/couponController');

router.get('/offers', getPublicOffers);
router.get('/manage', auth, allowRoles('admin'), getManagedCoupons);
router.post('/manage', auth, allowRoles('admin'), createCouponValidation, validate, createManagedCoupon);
router.put('/manage/:id', auth, allowRoles('admin'), updateManagedCoupon);
router.delete('/manage/:id', auth, allowRoles('admin'), deleteManagedCoupon);

module.exports = router;
