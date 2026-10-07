// Mock for remark-parse - just returns a pass-through function
module.exports = () => {
  return () => {};
};

module.exports.default = module.exports;
