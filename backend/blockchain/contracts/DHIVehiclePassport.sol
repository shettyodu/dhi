// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title DHI Vehicle Passport
/// @notice An ERC-721 "vehicle passport": one token per VIN that anchors the
///         SHA-256 hash of a canonical, off-chain vehicle provenance record
///         (title, history, ownership). This is a verifiable digital record —
///         NOT a security or financial instrument. The DMV legal title is
///         unchanged; this token is a complementary, tamper-evident record.
contract DHIVehiclePassport is ERC721URIStorage, Ownable {
    uint256 private _nextId = 1;

    /// @dev tokenId => SHA-256 hash of the canonical off-chain record.
    mapping(uint256 => bytes32) private _recordHash;

    /// @dev VIN hash (keccak256 of uppercased VIN) => tokenId, to prevent dupes
    ///      and allow lookup. 0 means "not minted".
    mapping(bytes32 => uint256) public tokenIdByVin;

    event PassportMinted(
        uint256 indexed tokenId,
        bytes32 indexed vinHash,
        bytes32 recordHash,
        address to
    );

    constructor() ERC721("DHI Vehicle Passport", "DHIVP") Ownable(msg.sender) {}

    /// @notice Mint a passport. Owner-only (DHI is the issuer/minter).
    /// @param to         recipient (vehicle owner or DHI custodial wallet)
    /// @param vinHash    keccak256 of the uppercased VIN
    /// @param recordHash SHA-256 of the canonical off-chain record
    /// @param uri        metadata URI (off-chain record / passport view)
    function mintPassport(
        address to,
        bytes32 vinHash,
        bytes32 recordHash,
        string calldata uri
    ) external onlyOwner returns (uint256 tokenId) {
        require(tokenIdByVin[vinHash] == 0, "VIN already has a passport");
        tokenId = _nextId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        _recordHash[tokenId] = recordHash;
        tokenIdByVin[vinHash] = tokenId;
        emit PassportMinted(tokenId, vinHash, recordHash, to);
    }

    /// @notice The anchored record hash for a token (for verification).
    function recordHashOf(uint256 tokenId) external view returns (bytes32) {
        _requireOwned(tokenId);
        return _recordHash[tokenId];
    }
}
