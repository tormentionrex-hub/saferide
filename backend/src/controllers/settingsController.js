const { Setting } = require('../models');

const GOAL_KEY = 'monthlyCarbonGoal';
const DEFAULT_GOAL = 200;

const parseGoal = (value) => {
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return Math.round(numero * 10) / 10;
};

exports.getMonthlyCarbonGoal = async (req, res, next) => {
  try {
    const setting = await Setting.findOne({ key: GOAL_KEY }).lean();
    const value = parseGoal(setting?.value) ?? DEFAULT_GOAL;
    res.status(200).json({ success: true, data: { key: GOAL_KEY, value } });
  } catch (error) {
    next(error);
  }
};

exports.updateMonthlyCarbonGoal = async (req, res, next) => {
  try {
    const value = parseGoal(req.body?.value ?? req.body?.goal);
    if (value === null) {
      return res.status(400).json({
        success: false,
        message: 'La meta debe ser un número mayor a 0',
      });
    }

    const setting = await Setting.findOneAndUpdate(
      { key: GOAL_KEY },
      { $set: { value } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    res.status(200).json({
      success: true,
      data: { key: GOAL_KEY, value: parseGoal(setting.value) ?? value },
    });
  } catch (error) {
    next(error);
  }
};
