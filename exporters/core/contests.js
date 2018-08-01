/**
 * Export contests for an election.
 */

// Dependencies

// Export function
module.exports = async ({ logger, config, models, db, argv }) => {
  let contests = await models.Contest.findAll({}, { include: { all: true } });
  contests.forEach(c => {
    console.log(c);
  });
};
