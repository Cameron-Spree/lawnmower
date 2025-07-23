
import React from 'react';

interface ProductCardProps {
  name: string;
  sku?: string; 
  imageUrl?: string;
  productUrl?: string;
  description?: string;
  features?: string;
  priceString?: string; 
  reasoning?: string;
}

const ProductCard: React.FC<ProductCardProps> = ({ name, sku, imageUrl, productUrl, description, features, priceString, reasoning }) => {
  const hasValidImageUrl = imageUrl && imageUrl.trim() !== "";
  const hasValidProductUrl = productUrl && productUrl.trim() !== "";

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200 my-4">
      {/* Top Section: Image and Reasoning */}
      <div className="flex flex-col sm:flex-row">
        {/* Left Column: Image */}
        <div className="sm:w-2/5 p-3 flex-shrink-0">
          <div className="aspect-square bg-gray-100 flex items-center justify-center rounded-md overflow-hidden">
            {hasValidImageUrl ? (
              <img
                src={imageUrl}
                alt={`Image of ${name}`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const imgElement = e.currentTarget;
                  imgElement.style.display = 'none';
                  const placeholder = imgElement.nextElementSibling; 
                  if (placeholder && placeholder.classList.contains('image-placeholder-text-on-error')) {
                     placeholder.classList.remove('hidden');
                  } else {
                     const generalPlaceholder = Array.from(imgElement.parentElement?.children || []).find(el => el.classList.contains('image-placeholder-text'));
                     if(generalPlaceholder) generalPlaceholder.classList.remove('hidden');
                  }
                }}
              />
            ) : (
              <div className="text-center text-gray-500 image-placeholder-text p-2">
                <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-1 text-xs">Image not available</p>
              </div>
            )}
            {hasValidImageUrl && (
                <div className="hidden text-center text-gray-500 image-placeholder-text-on-error p-2">
                    <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-1 text-xs">Image loading failed</p>
                </div>
            )}
          </div>
        </div>

        {/* Right Column: Reasoning */}
        <div className="sm:w-3/5 p-3 flex flex-col justify-center">
          {reasoning && (
            <div className="h-full p-3 bg-green-50 border border-green-200 rounded-md flex flex-col justify-center">
              <p className="text-sm font-semibold text-green-700 mb-1">Expert Bot's Reasoning:</p>
              <p className="text-sm text-green-600" style={{ whiteSpace: 'pre-line' }}>{reasoning}</p>
            </div>
          )}
          {!reasoning && (
            <div className="h-full p-3 bg-gray-50 border border-gray-200 rounded-md flex flex-col justify-center items-center text-center">
                 <p className="text-xs text-gray-400">No specific reasoning provided for this product in this context.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Other Details */}
      <div className="p-4">
        <h3 className="text-xl font-bold text-primary mb-1">{name}</h3>
        {sku && (
          <p className="text-xs text-textLight mb-2">SKU: {sku}</p>
        )}

        {description && (
          <div className="text-sm text-textDark mb-3">
            <strong className="font-semibold">Description:</strong>
            <p style={{ whiteSpace: 'pre-line' }}>{description}</p>
          </div>
        )}

        {features && (
          <div className="text-sm text-textDark mb-3">
            <strong className="font-semibold">Features:</strong>
            <div style={{ whiteSpace: 'pre-line' }} className="pl-1">{features}</div>
          </div>
        )}
        
        {priceString && (
          <p className="text-lg font-semibold text-textDark mb-3">
            {priceString}
          </p>
        )}

        <div className="flex items-center space-x-2">
          <a
            href={hasValidProductUrl ? productUrl : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-block text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-150 ease-in-out text-sm ${
              hasValidProductUrl ? 'bg-primary hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
            aria-disabled={!hasValidProductUrl}
            onClick={(e) => { if (!hasValidProductUrl) e.preventDefault(); }}
          >
            View Product
          </a>
          <button
            onClick={() => {
              const productInfo = `
                Name: ${name}
                SKU: ${sku}
                Price: ${priceString}
                Description: ${description}
                Features: ${features}
                Reasoning: ${reasoning}
              `;
              navigator.clipboard.writeText(productInfo.trim());
            }}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors duration-150 ease-in-out text-sm"
          >
            Copy Info
          </button>
        </div>
        
        {/* Reasoning moved to the top section, so it's commented out/removed from here if it was previously duplicated */}
      </div>
    </div>
  );
};

export default ProductCard;
