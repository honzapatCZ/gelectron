#include "stable.h"
#include "overlay/hookapp.h"
#include "overlay/overlay.h"
#include "overlay/session.h"
#include "d3d11sprite.h"
#include "D3d11Graphics.h"

D3d11Graphics::D3d11Graphics()
{

}

D3d11Graphics::~D3d11Graphics()
{
    freeGraphics();
}

Windows::ComPtr<IDXGISwapChain> D3d11Graphics::swapChain() const
{
    return swap_;
}

void D3d11Graphics::freeGraphics()
{
    __super::freeGraphics();

    ZeroMemory(&savedStatus_, sizeof(savedStatus_));
    blockSprite_ = nullptr;

    rasterizeState_ = nullptr;
    transparentBlendState_ = nullptr;
    depthStencilState_ = nullptr;

    renderTargetView_ = nullptr;
    d3dContext_ = nullptr;
    d3dDevice_ = nullptr;
    swap_ = nullptr;
}

bool D3d11Graphics::_initGraphicsContext(IDXGISwapChain* swap)
{
    swap_ = swap;

    HRESULT hr;

    hr = swap->GetDevice(__uuidof(ID3D11Device), (LPVOID*)d3dDevice_.resetAndGetPointerAddress());

    if (!d3dDevice_)
    {
        return false;
    }

    d3dDevice_->GetImmediateContext(d3dContext_.resetAndGetPointerAddress());

    Windows::ComPtr<ID3D11Texture2D> backBufferTexture;
    swap->GetBuffer(0, __uuidof(ID3D11Texture2D), (LPVOID*)backBufferTexture.resetAndGetPointerAddress());
    if (!backBufferTexture)
    {
        return false;
    }

    DXGI_SWAP_CHAIN_DESC swapChainDesc;
    swap->GetDesc(&swapChainDesc);

    D3D11_TEXTURE2D_DESC textureDesc;
    backBufferTexture->GetDesc(&textureDesc);

    targetWidth_ = textureDesc.Width;
    targetHeight_ = textureDesc.Height;
    dxgiformat_ = fixCopyTextureFormat(swapChainDesc.BufferDesc.Format);
    isSRGB_ = isSRGBFormat(swapChainDesc.BufferDesc.Format);
    windowed_ = !!swapChainDesc.Windowed;

    hr = d3dDevice_->CreateRenderTargetView(backBufferTexture, nullptr, renderTargetView_.resetAndGetPointerAddress());
    if (!renderTargetView_)
    {
        return false;
    }

    return true;
}

bool D3d11Graphics::_initGraphicsState()
{
    HRESULT hr;
    D3D11_DEPTH_STENCIL_DESC desc;
    ZeroMemory(&desc, sizeof(desc));
    desc.DepthEnable = false;
    desc.DepthWriteMask = D3D11_DEPTH_WRITE_MASK_ALL;
    desc.DepthFunc = D3D11_COMPARISON_LESS;
    desc.StencilEnable = false;
    desc.StencilReadMask = 0xff;
    desc.StencilWriteMask = 0xff;

    hr = d3dDevice_->CreateDepthStencilState(&desc, depthStencilState_.resetAndGetPointerAddress());
    if (!depthStencilState_)
    {
        return false;
    }

    D3D11_BLEND_DESC transDesc;
    ZeroMemory(&transDesc, sizeof(transDesc));
    transDesc.AlphaToCoverageEnable = FALSE;
    transDesc.IndependentBlendEnable = FALSE;
    transDesc.RenderTarget[0].BlendEnable = TRUE;
    transDesc.RenderTarget[0].SrcBlend = D3D11_BLEND_SRC_ALPHA;
    transDesc.RenderTarget[0].DestBlend = D3D11_BLEND_INV_SRC_ALPHA;
    transDesc.RenderTarget[0].BlendOp = D3D11_BLEND_OP_ADD;
    transDesc.RenderTarget[0].SrcBlendAlpha = D3D11_BLEND_ONE;
    transDesc.RenderTarget[0].DestBlendAlpha = D3D11_BLEND_ZERO;
    transDesc.RenderTarget[0].BlendOpAlpha = D3D11_BLEND_OP_ADD;
    transDesc.RenderTarget[0].RenderTargetWriteMask = D3D11_COLOR_WRITE_ENABLE_ALL;

    hr = d3dDevice_->CreateBlendState(&transDesc, transparentBlendState_.resetAndGetPointerAddress());
    if (!transparentBlendState_)
    {
        return false;
    }

    D3D11_RASTERIZER_DESC rDesc = {};
    rDesc.CullMode = D3D11_CULL_BACK;
    rDesc.FillMode = D3D11_FILL_SOLID;
    rDesc.FrontCounterClockwise = false;
    rDesc.DepthClipEnable = true;
    d3dDevice_->CreateRasterizerState(&rDesc, rasterizeState_.resetAndGetPointerAddress());

    if (!rasterizeState_)
    {
        return false;
    }

    return true;
}

void D3d11Graphics::_initSpriteDrawer()
{
    sprite_.reset(new D3d11SpriteDrawer(d3dDevice_, d3dContext_));
    sprite_->init(session::loadModuleD3dCompiler47(), targetWidth_, targetHeight_, isSRGB_);
}

bool D3d11Graphics::_createSprites()
{
    D3D11_TEXTURE2D_DESC textureDesc;
    textureDesc.Width = targetWidth_;
    textureDesc.Height = targetHeight_;
    textureDesc.MipLevels = 1;
    textureDesc.ArraySize = 1;
    textureDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    textureDesc.SampleDesc.Count = 1;
    textureDesc.SampleDesc.Quality = 0;

    textureDesc.Usage = D3D11_USAGE_DYNAMIC;
    textureDesc.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    textureDesc.CPUAccessFlags = D3D11_CPU_ACCESS_WRITE;
    textureDesc.MiscFlags = 0;

    if (SUCCEEDED(d3dDevice_->CreateTexture2D(&textureDesc, nullptr, blockSprite_.resetAndGetPointerAddress())))
    {
        D3D11_MAPPED_SUBRESOURCE ms = {};
        d3dContext_->Map(blockSprite_, 0, D3D11_MAP_WRITE_DISCARD, NULL, &ms);
        int* bytePointer = (int*)ms.pData;
        memset(bytePointer, 0xff, ms.RowPitch * textureDesc.Height);
        d3dContext_->Unmap(blockSprite_, 0);
        return true;
    }
    return false;
}

void D3d11Graphics::_createWindowSprites()
{
    HookApp::instance()->overlayConnector()->lockWindows();

    auto windows = HookApp::instance()->overlayConnector()->windows();

    for (const auto& w : windows)
    {
        auto windowSprite = _createWindowSprite(w);
        if (windowSprite)
        {

            windowSprites_.push_back(windowSprite);
        }
    }

    HookApp::instance()->overlayConnector()->unlockWindows();
}

Windows::ComPtr<ID3D11Texture2D> D3d11Graphics::_createDynamicTexture(std::uint32_t width, std::uint32_t height)
{
    Windows::ComPtr<ID3D11Texture2D> texture;
    D3D11_TEXTURE2D_DESC textureDesc;
    textureDesc.Width = width;
    textureDesc.Height = height;
    textureDesc.MipLevels = 1;
    textureDesc.ArraySize = 1;
    textureDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    textureDesc.SampleDesc.Count = 1;
    textureDesc.SampleDesc.Quality = 0;

    textureDesc.Usage = D3D11_USAGE_DYNAMIC;
    textureDesc.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    textureDesc.CPUAccessFlags = D3D11_CPU_ACCESS_WRITE;
    textureDesc.MiscFlags = 0;

    HRESULT hr = d3dDevice_->CreateTexture2D(&textureDesc, nullptr, texture.resetAndGetPointerAddress());
    if (FAILED(hr))
    {
        LOGGER("n_overlay") << L"CreateTexture2D, failed:" << hr;
        std::cout << "D3d11Graphics::_createDynamicTexture CreateTexture2D, failed:" << hr << std::endl;
        return nullptr;
    }

    return texture;
}

std::shared_ptr<CommonWindowSprite> D3d11Graphics::_createWindowSprite(const std::shared_ptr<overlay::Window>& window)
{
    std::shared_ptr<CommonWindowSprite> commonWindowSprite = __super::_createWindowSprite(window);
    std::shared_ptr<D3d11WindowSprite> windowSprite = std::dynamic_pointer_cast<D3d11WindowSprite>(commonWindowSprite);

    windowSprite->texture = _createDynamicTexture(window->rect.width, window->rect.height);
    if (!windowSprite->texture)
    {
        return nullptr;
    }


    _updateSprite(windowSprite, true);
    return windowSprite;
}

void D3d11Graphics::_updateSprite(std::shared_ptr<D3d11WindowSprite>& windowSprite, bool clear /*= false*/)
{
    if (!windowSprite->texture)
    {
        return;
    }

    D3D11_MAPPED_SUBRESOURCE ms = {};
    HRESULT hr = d3dContext_->Map(windowSprite->texture, 0, D3D11_MAP_WRITE_DISCARD, NULL, &ms);
    if (FAILED(hr))
    {
        LOGGER("n_overlay") << L"update sprite failed:" << hr;
    }

    if (!ms.pData)
    {
        return;
    }

    int* bytePointer = (int*)ms.pData;

    if (clear)
    {
        memset(bytePointer, 0, sizeof(int) * windowSprite->rect.width * windowSprite->rect.height);
    }

    HookApp::instance()->overlayConnector()->lockShareMem();
    char *orgin = static_cast<char*>(windowSprite->windowBitmapMem->get_address());
    if (orgin)
    {
        overlay::ShareMemFrameBuffer* head = (overlay::ShareMemFrameBuffer*)orgin;
        int width = std::min(windowSprite->rect.width, head->width);
        int height = std::min(windowSprite->rect.height, head->height);

        std::uint32_t* mem = (std::uint32_t*)(orgin + sizeof(overlay::ShareMemFrameBuffer));
        int spriteWidth = ms.RowPitch / sizeof(std::uint32_t);

        for (int i = 0; i != height; ++i)
        {
            const std::uint32_t* line = mem + i * head->width;
            int xx = i * spriteWidth;
            memcpy((bytePointer + xx), line, sizeof(int) * width);
        }
    }

    HookApp::instance()->overlayConnector()->unlockShareMem();

    d3dContext_->Unmap(windowSprite->texture, 0);
}
void D3d11Graphics::_syncPendingBounds(std::map<std::uint32_t, overlay::WindowRect> pendingBounds_) {
    for (const auto& [windowId, rect] : pendingBounds_)
    {
        auto it = std::find_if(windowSprites_.begin(), windowSprites_.end(), [windowId](const auto& window) {
            return windowId == window->windowId;
        });
        if (it != windowSprites_.end())
        {
            auto& windowSprite = *it;
            windowSprite->rect = rect;

            D3D11_TEXTURE2D_DESC desc = { 0 };

            if (windowSprite->texture)
            {
                windowSprite->texture->GetDesc(&desc);
            }

            if (desc.Width == windowSprite->rect.width
                && desc.Height == windowSprite->rect.height)
            {
                continue;
            }
            else if (desc.Width < (UINT)windowSprite->rect.width
                || desc.Height < (UINT)windowSprite->rect.height)
            {
                //create a new larger texture

                windowSprite->texture = _createDynamicTexture(windowSprite->rect.width, windowSprite->rect.height);
                if (!windowSprite->texture)
                {
                    windowSprites_.erase(it);
                    continue;
                }

                _updateSprite(windowSprite, true);
            }
            else
            {
                _updateSprite(windowSprite, true);
            }
        }
    }
}
void D3d11Graphics::_drawBlockSprite()
{
    RECT  drawRect = { 0, 0, (LONG)targetWidth_, (LONG)targetHeight_ };
    sprite_->drawUnscaleSprite(blockSprite_, drawRect, 0x800c0c0c);
}

void D3d11Graphics::_drawWindowSprites()
{
    for (auto& windowSprite : windowSprites_)
    {
        if (!windowSprite->alwaysOnTop && !HookApp::instance()->uiapp()->isInterceptingInput())
            continue;
       _drawWindowSprite(windowSprite);
    }
}
void D3d11Graphics::_drawWindowSprite(std::shared_ptr<D3d11WindowSprite>& windowSprite)
{
    RECT  drawRect = { windowSprite->rect.x, windowSprite->rect.y, windowSprite->rect.x + windowSprite->rect.width , windowSprite->rect.y + windowSprite->rect.height };

    sprite_->drawUnscaleSprite(windowSprite->texture, drawRect);
}

void D3d11Graphics::_saveStatus()
{
    d3dContext_->IAGetInputLayout(&savedStatus_.input_layout);
    d3dContext_->IAGetVertexBuffers(0, 1, &savedStatus_.vertex, &savedStatus_.vertex_stride, &savedStatus_.vertex_offset);
    d3dContext_->IAGetPrimitiveTopology((D3D11_PRIMITIVE_TOPOLOGY *)&savedStatus_.draw_style);

    d3dContext_->VSGetShader(&savedStatus_.vertex_shader, 0, 0);
    d3dContext_->PSGetShader(&savedStatus_.pixel_shader, 0, 0);
    d3dContext_->VSGetConstantBuffers(0, 1, &savedStatus_.const_buffer);
    d3dContext_->PSGetShaderResources(0, 1, &savedStatus_.shader_view);
    d3dContext_->OMGetDepthStencilState(&savedStatus_.depth_stencil_state,
        &savedStatus_.stencil_ref);
    d3dContext_->OMGetBlendState(&savedStatus_.blend_state, savedStatus_.blen_factor,
        &savedStatus_.blen_mask);
    d3dContext_->OMGetRenderTargets(1, &savedStatus_.render_target,
        &savedStatus_.depth_stencil);

    UINT number = D3D11_VIEWPORT_AND_SCISSORRECT_OBJECT_COUNT_PER_PIPELINE;
    d3dContext_->RSGetViewports(&number, savedStatus_.view_port);
    savedStatus_.view_port_nums = number;

    d3dContext_->RSGetState(&savedStatus_.rasterizer);

    d3dContext_->PSGetSamplers(0, 1, &savedStatus_.sampler_states);
}

void D3d11Graphics::_prepareStatus()
{
    d3dContext_->OMSetDepthStencilState(depthStencilState_, 0);

    float factor[4] = { 0.f, 0.f, 0.f, 0.f };
    d3dContext_->OMSetBlendState(transparentBlendState_, factor, 0xffffffff);

    d3dContext_->OMSetRenderTargets(1, renderTargetView_.getPointerAdress(), nullptr);

    d3dContext_->RSSetState(rasterizeState_);

    D3D11_VIEWPORT viewport;
    ZeroMemory(&viewport, sizeof(D3D11_VIEWPORT));

    viewport.Width = static_cast<float>(targetWidth_);
    viewport.Height = static_cast<float>(targetHeight_);
    viewport.MinDepth = 0.0f;
    viewport.MaxDepth = 1.0f;
    viewport.TopLeftX = 0.0f;
    viewport.TopLeftY = 0.0f;

    d3dContext_->RSSetViewports(1, &viewport);
}

void D3d11Graphics::_restoreStatus()
{

    d3dContext_->IASetInputLayout(savedStatus_.input_layout);
    d3dContext_->IASetVertexBuffers(0, 1, &savedStatus_.vertex, &savedStatus_.vertex_stride, &savedStatus_.vertex_offset);
    d3dContext_->IASetPrimitiveTopology((D3D11_PRIMITIVE_TOPOLOGY)savedStatus_.draw_style);
    d3dContext_->VSSetShader(savedStatus_.vertex_shader, 0, 0);
    d3dContext_->PSSetShader(savedStatus_.pixel_shader, 0, 0);

    d3dContext_->PSSetSamplers(0, 1, &savedStatus_.sampler_states);
    d3dContext_->VSSetConstantBuffers(0, 1, &savedStatus_.const_buffer);
    d3dContext_->PSSetShaderResources(0, 1, &savedStatus_.shader_view);
    d3dContext_->OMSetDepthStencilState(savedStatus_.depth_stencil_state,
        savedStatus_.stencil_ref);
    d3dContext_->OMSetBlendState(savedStatus_.blend_state,
        savedStatus_.blen_factor, savedStatus_.blen_mask);
    d3dContext_->OMSetRenderTargets(1, &savedStatus_.render_target,
        savedStatus_.depth_stencil);

    d3dContext_->RSSetViewports(savedStatus_.view_port_nums, savedStatus_.view_port);

    d3dContext_->RSSetState(savedStatus_.rasterizer);

    ReleaseCOM(savedStatus_.rasterizer);
    ReleaseCOM(savedStatus_.input_layout);
    ReleaseCOM(savedStatus_.vertex);
    ReleaseCOM(savedStatus_.vertex_shader);
    ReleaseCOM(savedStatus_.pixel_shader);
    ReleaseCOM(savedStatus_.const_buffer);
    ReleaseCOM(savedStatus_.shader_view);
    ReleaseCOM(savedStatus_.depth_stencil_state);
    ReleaseCOM(savedStatus_.blend_state);
    ReleaseCOM(savedStatus_.render_target);
    ReleaseCOM(savedStatus_.depth_stencil);
    ReleaseCOM(savedStatus_.sampler_states);

    ZeroMemory(&savedStatus_, sizeof(savedStatus_));
}
