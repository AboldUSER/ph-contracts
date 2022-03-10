// const {randomInt, sign } = require('crypto');
const ethers = require('ethers');


module.exports.getSignedMessage = async (phPlus, userAddress, signer) => {

	let messageHash = ethers.utils.solidityKeccak256(
		['bool', 'address'],
		[phPlus, userAddress]
	);
	let signedMessage = await signer.signMessage(
		ethers.utils.arrayify(messageHash)
	);
	return signedMessage;
};