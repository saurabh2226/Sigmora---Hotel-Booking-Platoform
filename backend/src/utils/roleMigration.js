const { Op } = require('sequelize');
const User = require('../models/User');
const { User: SqlUser } = require('../models/sql');

const LEGACY_ROLES = ['owner', 'superadmin'];

const migrateLegacyRoles = async () => {
  const mongoResult = await User.updateMany(
    { role: { $in: LEGACY_ROLES } },
    { $set: { role: 'admin' } }
  );

  let sqlAffected = 0;

  try {
    const [affectedRows] = await SqlUser.update(
      { role: 'admin' },
      { where: { role: { [Op.in]: LEGACY_ROLES } } }
    );
    sqlAffected = affectedRows;
  } catch (error) {
    console.warn('[RoleMigration] SQL role migration skipped:', error.message);
  }

  const mongoUpdated = mongoResult.modifiedCount || mongoResult.nModified || 0;
  if (mongoUpdated || sqlAffected) {
    console.log(`[RoleMigration] Normalized ${mongoUpdated} Mongo users and ${sqlAffected} SQL users to admin.`);
  }
};

module.exports = {
  migrateLegacyRoles,
};
