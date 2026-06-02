export const GALLERY_NFT_ABI = [
  "event GalleryCreated(uint256 indexed galleryId, address indexed owner)",
  "event ItemAdded(uint256 indexed galleryId, bytes32 indexed itemKey, bytes packedRef)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function createGallery(string title, string description) returns (uint256 galleryId)",
  "function setGalleryFields(uint256 galleryId, string title, string description)",
  "function addItem(uint256 galleryId, bytes packedRef, uint32 displayOrder, string label, string note) returns (bytes32 itemKey)",
  "function updateItemFields(uint256 galleryId, bytes32 itemKey, uint32 displayOrder, string label, string note)",
  "function removeItem(uint256 galleryId, bytes32 itemKey)",
  "function notifyMetadataUpdate(uint256 galleryId)",
  "function contractVersion() view returns (string)",
  "function FEATURE_EXTRA_DATA() view returns (bytes32)",
  "function supportsGalleryNFTFeature(bytes32 feature) view returns (bool)",
  "function setGalleryExtraData(uint256 galleryId, bytes32 schema, bytes data)",
  "function setItemExtraData(uint256 galleryId, bytes32 itemKey, bytes32 schema, bytes data)",
  "function getGalleryExtraData(uint256 galleryId, bytes32 schema) view returns (bytes data)",
  "function getGalleryExtraSchemas(uint256 galleryId) view returns (bytes32[] schemas)",
  "function getItemExtraData(uint256 galleryId, bytes32 itemKey, bytes32 schema) view returns (bytes data)",
  "function getItemExtraSchemas(uint256 galleryId, bytes32 itemKey) view returns (bytes32[] schemas)",
  "function getGallery(uint256 galleryId) view returns (string title, string description, uint64 createdAt, uint64 updatedAt, address owner)",
  "function getGalleryItems(uint256 galleryId) view returns (bytes32[] itemKeys)",
  "function getItemFields(uint256 galleryId, bytes32 itemKey) view returns (uint32 displayOrder, string label, string note)",
  "function getItemPackedRef(uint256 galleryId, bytes32 itemKey) view returns (bytes packedRef)",
  "function getItemStatus(uint256 galleryId, bytes32 itemKey) view returns (uint64 addedAt, uint64 removedAt, bool isActive)",
  "function tokenURI(uint256 galleryId) view returns (string)",
] as const;

export const GALLERY_NFT_FACTORY_ABI = [
  "event CollectionCreated(address indexed collection, address indexed creator, string name, string symbol)",
  "function createCollection(string name, string symbol) returns (address collection)",
  "function collectionCount() view returns (uint256)",
  "function getCollectionsByCreator(address creator) view returns (address[] collections)",
  "function isGalleryNFTCollection(address collection) view returns (bool)",
] as const;

export const GALLERY_NFT_ADDRESS = process.env.NEXT_PUBLIC_GALLERYNFT_ADDRESS || "";
export const GALLERY_NFT_FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_GALLERYNFT_FACTORY_ADDRESS || "";
export const GALLERY_NFT_FACTORY_VERSION =
  process.env.NEXT_PUBLIC_GALLERYNFT_FACTORY_VERSION || "";
export const GALLERY_NFT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_GALLERYNFT_CHAIN_ID || "11155111"
);
export const GALLERY_NFT_EXPLORER_BASE_URL =
  process.env.NEXT_PUBLIC_GALLERYNFT_EXPLORER_BASE_URL ||
  (GALLERY_NFT_CHAIN_ID === 11155111 ? "https://sepolia.etherscan.io" : "");

export const GALLERY_NFT_FEATURE_EXTRA_DATA =
  "0xb63ca5fbb8012e8389c46a8edad345508d0eb2d9486e0578f272d73801dd25e0";
export const GALLERY_NFT_SCHEMA_ITEM_DISPLAY =
  "0x57e53cad3bebe04d5d59315024f083fc77f9311e69e5ea39b94aaf0dffd70055";
export const GALLERY_NFT_SCHEMA_ITEM_WALLTEXT =
  "0x01e3108925013dfe7f61219813a9b17380bcae5d0b2c65f770684c79f24baf24";

export function isWalletModeEnabled() {
  return isAddressLike(GALLERY_NFT_ADDRESS) || isFactoryModeEnabled();
}

export function isFactoryModeEnabled() {
  return isAddressLike(GALLERY_NFT_FACTORY_ADDRESS);
}

export function isAddressLike(value: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}
