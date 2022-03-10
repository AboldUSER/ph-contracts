//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC721AUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/ITestStaking.sol";

import "hardhat/console.sol";

contract TestERC721 is Initializable, ERC721AUpgradeable, OwnableUpgradeable {
    using StringsUpgradeable for uint256;

    uint256 public constant TOTAL_MAX = 10000;
    uint256 public constant RESERVE_MAX = 250;
    uint256 public constant PAPERLIST_MINT_PRICE = 0.07 ether;
    uint256 public constant MINT_PRICE = 0.08 ether;
    uint256 public constant PAPERLIST_PLUS_MAX = 5;
    uint256 public constant QUANTITY_MAX = 3;

    // presaleMinter => uint256
    mapping(address => uint256) private presaleMinted;

    address private signer;
    address public payoutAddress;
    address public testStaking;

    uint256 public reserveAmountMinted;
    bool public phPlusActive;
    bool public presaleActive;
    bool public saleActive;
    bool private revealed;
    string private baseURI;

    uint96 private royaltyBasisPoints;
    bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;

    function initialize(address _signer) public initializer {
        __ERC721A_init("TestNFT", "TNFT");
        __Ownable_init();
        signer = _signer;
        royaltyBasisPoints = 500;
    }

    function presaleMint(
        uint256 _quantity,
        bool phPlus,
        bytes memory _signature,
        bool stake
    ) external payable {
        require(presaleActive, "NOT_ACTIVE");
        if (phPlus && phPlusActive) {
            require(_quantity <= PAPERLIST_PLUS_MAX && _quantity != 0, "INVALID_QUANTITY");
        } else {
            require(!phPlusActive, "TOO_EARLY");
            require(_quantity <= QUANTITY_MAX && _quantity != 0, "INVALID_QUANTITY");
        }
        require(totalSupply() + _quantity <= TOTAL_MAX, "TOTAL_EXCEEDED");
        require(presaleMinted[msg.sender] == 0, "ALREADY_MINTED");
        require(
            matchSigner(hashTransaction(phPlus, msg.sender), _signature),
            "UNAUTHORIZED"
        );
        require(
            msg.value >= PAPERLIST_MINT_PRICE * _quantity,
            "INSUFFICIENT_ETH"
        );
        presaleMinted[msg.sender] = 3;
        _safeMint(msg.sender, _quantity);
        if (stake) {
            uint256 _totalSupply = totalSupply(); 
            uint256[] memory tokenIds = new uint256[](_quantity);
            for (uint256 i = _quantity; i != 0; i--) {
                tokenIds[i-1] = _totalSupply - i;
            }
            setApprovalForAll(testStaking, true);
            ITestStaking(testStaking).stakeLock(msg.sender, tokenIds);
            setApprovalForAll(testStaking, false);
        }
    }

    function mint(uint256 _quantity, bool stake) external payable {
        require(saleActive, "NOT_ACTIVE");
        require(tx.origin == msg.sender, "NOT_EOA");
        require(totalSupply() + _quantity <= TOTAL_MAX, "TOTAL_EXCEEDED");
        require(msg.value >= MINT_PRICE * _quantity, "INSUFFICIENT_ETH");
        if (presaleMinted[msg.sender] == 0) {
            require(
                _numberMinted(msg.sender) + _quantity <= QUANTITY_MAX && _quantity != 0,
                "INVALID_QUANTITY"
            );
        } else {
            require(_quantity <= presaleMinted[msg.sender] && _quantity != 0, "INVALID_QUANTITY");
            presaleMinted[msg.sender] -= _quantity;
        }
        _mint(msg.sender, _quantity, "", true);
        if (stake) {
            uint256 _totalSupply = totalSupply(); 
            uint256[] memory tokenIds = new uint256[](_quantity);
            for (uint256 i = _quantity; i != 0; i--) {
                tokenIds[i-1] = _totalSupply - i;
            }
            setApprovalForAll(testStaking, true);
            ITestStaking(testStaking).stakeLock(msg.sender, tokenIds);
            setApprovalForAll(testStaking, false);
        }
    }

    /**
     * @notice release reserve
     */
    function releaseReserve(address _account, uint256 _quantity)
        external
        onlyOwner
    {
        require(_quantity > 0, "INVALID_QUANTITY");
        require(reserveAmountMinted + _quantity <= RESERVE_MAX, "RESERVE_MAXED");
        reserveAmountMinted += _quantity;
        _safeMint(_account, _quantity);
    }

    function walletOfOwner(address _owner)
        public
        view
        returns (uint256[] memory)
    {
        uint256 ownerTokenCount = balanceOf(_owner);
        uint256[] memory tokenIds = new uint256[](ownerTokenCount);
        for (uint256 i; i < ownerTokenCount; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return tokenIds;
    }

    function hashTransaction(bool phPlus, address wallet)
        internal
        pure
        returns (bytes32)
    {
        bytes32 hash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(phPlus, wallet))
            )
        );
        return hash;
    }

    function matchSigner(bytes32 hash, bytes memory signature)
        internal
        view
        returns (bool)
    {
        return signer == ECDSAUpgradeable.recover(hash, signature);
    }

    /**
     * @notice active presale
     */
    function togglePresale(bool presale, bool phPlus) external onlyOwner {
        presaleActive = presale;
        phPlusActive = phPlus;
    }

    /**
     * @notice active sale
     */
    function toggleSale() external onlyOwner {
        if (presaleActive) presaleActive = false;
        !saleActive ? saleActive = true : saleActive = false;
    }

    /**
     * @notice set base URI
     */
    function setBaseURI(string calldata _baseURI, bool reveal) external onlyOwner {
        revealed = reveal; 
        baseURI = _baseURI;
    }

    /**
     * @notice set payment addresses
     */
    function setPaymentAddress(address _payoutAddress) external onlyOwner {
        payoutAddress = _payoutAddress;
    }

    /**
     * @notice transfer funds
     */
    function transferFunds() external onlyOwner {
        (bool success, ) = payable(payoutAddress).call{
            value: address(this).balance
        }("");
        require(success, "TRANSFER_FAILED");
    }

    /**
     * @notice royalty information
     */
    function royaltyInfo(uint256 _tokenId, uint256 _salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount)
    {
        require(_exists(_tokenId), "ERC721: URI query for nonexistent token");
        return (payoutAddress, (_salePrice * royaltyBasisPoints) / 10000);
    }

    /**
     * @notice supports interface
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721AUpgradeable)
        returns (bool)
    {
        if (interfaceId == _INTERFACE_ID_ERC2981) {
            return true;
        }
        return super.supportsInterface(interfaceId);
    }

    function setTestStaking(address _testStaking) external onlyOwner {
        testStaking = _testStaking;
    }

    function getTestERC721FromWallet(address wallet)
        public
        view
        returns (uint256[] memory)
    {
        uint256 tokenCount = balanceOf(wallet);
        if (tokenCount == 0) {
            return new uint256[](0);
        }

        uint256[] memory tokensId = new uint256[](tokenCount);
        for (uint256 i; i < tokenCount; i++) {
            tokensId[i] = tokenOfOwnerByIndex(wallet, i);
        }
        return tokensId;
    }

    /**
     * @notice token URI
     */
    function tokenURI(uint256 _tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(_exists(_tokenId), "Cannot query non-existent token");
        if (revealed) {
        return string(abi.encodePacked(baseURI, _tokenId.toString(), ".json"));
        } else{
            return baseURI;
        }
    }

    function batchTransferFrom(
        address _from,
        address _to,
        uint256[] memory _tokenIds
    ) public {
        for (uint256 i; i < _tokenIds.length; i++) {
            transferFrom(_from, _to, _tokenIds[i]);
        }
    }

    function batchSafeTransferFrom(
        address _from,
        address _to,
        uint256[] memory _tokenIds,
        bytes memory _data
    ) public {
        for (uint256 i; i < _tokenIds.length; i++) {
            safeTransferFrom(_from, _to, _tokenIds[i], _data);
        }
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        ITestStaking(testStaking).transferRewards(from, to);
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override {
        ITestStaking(testStaking).transferRewards(from, to);
        super.safeTransferFrom(from, to, tokenId, data);
    }
}
