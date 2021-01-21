#include "stable.h"

#include "overlay/hookapp.h"
#include "overlay/overlay.h"
#include "overlay/session.h"

#include "dxsdk/Include/d3dx9.h"
#include "d3d9graphics.h"

namespace {

    typedef HRESULT(WINAPI* pFnD3DXSaveSurfaceToFileW)(
        LPCWSTR                   pDestFile,
        D3DXIMAGE_FILEFORMAT      DestFormat,
        LPDIRECT3DSURFACE9        pSrcSurface,
        CONST PALETTEENTRY*       pSrcPalette,
        CONST RECT*               pSrcRect);

    typedef HRESULT(WINAPI* pFnD3DXCreateFontIndirectW)(
        LPDIRECT3DDEVICE9       pDevice,
        CONST D3DXFONT_DESCW*   pDesc,
        LPD3DXFONT*             ppFont);

    typedef HRESULT(WINAPI *pFnD3DXCreateSprite)(
        LPDIRECT3DDEVICE9   pDevice,
        LPD3DXSPRITE*       ppSprite);


    typedef D3DXMATRIX* (WINAPI *pFnD3DXMatrixTransformation2D)
        (D3DXMATRIX *pOut, CONST D3DXVECTOR2* pScalingCenter,
            FLOAT ScalingRotation, CONST D3DXVECTOR2* pScaling,
            CONST D3DXVECTOR2* pRotationCenter, FLOAT Rotation,
            CONST D3DXVECTOR2* pTranslation);

    namespace D3DX9Api {

        HRESULT WINAPI
            D3DXSaveSurfaceToFileW(HMODULE hModuleD3dx9,
                LPCWSTR                   pDestFile,
                D3DXIMAGE_FILEFORMAT      DestFormat,
                LPDIRECT3DSURFACE9        pSrcSurface,
                CONST PALETTEENTRY*       pSrcPalette,
                CONST RECT*               pSrcRect)
        {
            pFnD3DXSaveSurfaceToFileW fn = nullptr;

            if (hModuleD3dx9)
            {
                fn = (pFnD3DXSaveSurfaceToFileW)GetProcAddress(hModuleD3dx9, "D3DXSaveSurfaceToFileW");
            }
            if (fn)
            {
                return fn(pDestFile, DestFormat, pSrcSurface, pSrcPalette, pSrcRect);
            }
            else
            {
                return -1;
            }
        }

        HRESULT WINAPI D3DXCreateFontIndirectW(HMODULE hModuleD3dx9,
            LPDIRECT3DDEVICE9       pDevice,
            CONST D3DXFONT_DESCW*   pDesc,
            LPD3DXFONT*             ppFont)
        {
            pFnD3DXCreateFontIndirectW fn = nullptr;

            if (hModuleD3dx9)
            {
                fn = (pFnD3DXCreateFontIndirectW)GetProcAddress(hModuleD3dx9, "D3DXCreateFontIndirectW");
            }
            if (fn)
            {
                return fn(pDevice, pDesc, ppFont);
            }
            else
            {
                return -1;
            }
        }

        HRESULT WINAPI
            D3DXCreateSprite(HMODULE hModuleD3dx9,
                LPDIRECT3DDEVICE9   pDevice,
                LPD3DXSPRITE*       ppSprite)
        {
            pFnD3DXCreateSprite fn = nullptr;

            if (hModuleD3dx9)
            {
                fn = (pFnD3DXCreateSprite)GetProcAddress(hModuleD3dx9, "D3DXCreateSprite");
            }
            if (fn)
            {
                return fn(pDevice, ppSprite);
            }
            else
            {
                return -1;
            }
        }

        D3DXMATRIX* WINAPI D3DXMatrixTransformation2D
        (HMODULE hModuleD3dx9, D3DXMATRIX *pOut, CONST D3DXVECTOR2* pScalingCenter,
            FLOAT ScalingRotation, CONST D3DXVECTOR2* pScaling,
            CONST D3DXVECTOR2* pRotationCenter, FLOAT Rotation,
            CONST D3DXVECTOR2* pTranslation)
        {

            pFnD3DXMatrixTransformation2D fn = nullptr;
            if (hModuleD3dx9)
            {
                fn = (pFnD3DXMatrixTransformation2D)GetProcAddress(hModuleD3dx9, "D3DXMatrixTransformation2D");
            }
            if (fn)
            {
                return fn(pOut, pScalingCenter, ScalingRotation, pScaling, pRotationCenter, Rotation, pTranslation);
            }
            else
            {
                return pOut;
            }
        }

    }
}


//////////////////////////////////////////////////////////////////////////

D3d9Graphics::D3d9Graphics()
{

}

D3d9Graphics::~D3d9Graphics()
{
    freeGraphics();
}

bool D3d9Graphics::initGraphics(IDirect3DDevice9* device, HWND /*hDestWindowOverride*/, bool isD9Ex)
{
    DAssert(!device_);

    bool succeed = false;

    Windows::ComPtr<IDirect3DDevice9Ex> deviceEx;
    if (isD9Ex)
    {
        device->QueryInterface(__uuidof(IDirect3DDevice9Ex), (void**)deviceEx.resetAndGetPointerAddress());
    }

    succeed = _initGraphicsContext(device) ;
    if (succeed)
    {
        succeed = _initSpriteDrawer();
    }

    if (succeed)
    {
        _createSprites();
        _createWindowSprites();
    }

    if (!succeed)
    {
        freeGraphics();
    }

    if (succeed)
    {
        HookApp::instance()->overlayConnector()->windowEvent().add([this](std::uint32_t windowId) {
            std::lock_guard<std::mutex> lock(synclock_);
            syncState_.pendingWindows_.insert(windowId);
            needResync_ = true;
        }, this);

        HookApp::instance()->overlayConnector()->frameBufferEvent().add([this](std::uint32_t windowId) {
            std::lock_guard<std::mutex> lock(synclock_);
            syncState_.pendingFrameBuffers_.insert(windowId);
            needResync_ = true;
        }, this);

        HookApp::instance()->overlayConnector()->windowCloseEvent().add([this](std::uint32_t windowId) {
            std::lock_guard<std::mutex> lock(synclock_);
            syncState_.pendingClosed_.insert(windowId);
            needResync_ = true;
        }, this);

        HookApp::instance()->overlayConnector()->windowBoundsEvent().add([this](std::uint32_t windowId, overlay::WindowRect rect) {
            std::lock_guard<std::mutex> lock(synclock_);
            syncState_.pendingBounds_[windowId] = rect;
            needResync_ = true;
        }, this);

        HookApp::instance()->overlayConnector()->frameBufferUpdateEvent().add([this](std::uint32_t windowId) {
            std::lock_guard<std::mutex> lock(synclock_);
            syncState_.pendingFrameBufferUpdates_.insert(windowId);
            needResync_ = true;
        }, this);

        HookApp::instance()->overlayConnector()->windowFocusEvent().add([this](std::uint32_t windowId) {
            std::lock_guard<std::mutex> lock(synclock_);
            syncState_.focusWindowId_ = windowId;
            needResync_ = true;
        }, this);
    }

    if (succeed)
    {
        fpsTimer_.reset();
    }

    return succeed;
}

void D3d9Graphics::uninitGraphics(IDirect3DDevice9* device)
{
    if (device_.get() != device)
    {
        return;
    }

    freeGraphics();
}

void D3d9Graphics::freeGraphics()
{
    HookApp::instance()->overlayConnector()->windowEvent().remove(this);
    HookApp::instance()->overlayConnector()->frameBufferEvent().remove(this);
    HookApp::instance()->overlayConnector()->windowCloseEvent().remove(this);
    HookApp::instance()->overlayConnector()->windowBoundsEvent().remove(this);
    HookApp::instance()->overlayConnector()->frameBufferUpdateEvent().remove(this);
    HookApp::instance()->overlayConnector()->windowFocusEvent().remove(this);

    std::lock_guard<std::mutex> lock(synclock_);
    syncState_.pendingWindows_.clear();
    syncState_.pendingFrameBuffers_.clear();
    syncState_.pendingClosed_.clear();
    syncState_.pendingBounds_.clear();
    syncState_.pendingFrameBufferUpdates_.clear();
    syncState_.focusWindowId_ = 0;
    needResync_ = false;
    windowSprites_.clear();

    blockSprite_ = nullptr;
    spriteDrawer_ = nullptr;
    device_ = nullptr;
}

void D3d9Graphics::beforePresent(IDirect3DDevice9* device)
{
    if (device_ != device)
    {
        return;
    }

    session::setGraphicsThreadId(GetCurrentThreadId());

    if (fpsTimer_.tick() > 1000.)
    {
        HookApp::instance()->overlayConnector()->sendGraphicsFps(fpsTimer_.fps());
    }

    _checkAndResyncWindows();

    device_->BeginScene();
    D3DXMATRIX mat;
    D3DX9Api::D3DXMatrixTransformation2D(session::loadD3dx9(), &mat, nullptr, 0, nullptr, nullptr, 0, nullptr);

    spriteDrawer_->Begin(D3DXSPRITE_ALPHABLEND);
    spriteDrawer_->SetTransform(&mat);

    if (HookApp::instance()->uiapp()->isInterceptingInput())
    {
        _drawBlockSprite();

    }
    _drawWindowSprites();
    spriteDrawer_->End();
    device_->EndScene();
}

void D3d9Graphics::afterPresent(IDirect3DDevice9* device)
{
    if (device_ != device)
    {
        return;
    }
}

bool D3d9Graphics::_initGraphicsContext(IDirect3DDevice9* device)
{
    HRESULT hr;

    Windows::ComPtr<IDirect3DSwapChain9> spSwapChain = 0;
    hr = device->GetSwapChain(0, spSwapChain.resetAndGetPointerAddress());
    if (FAILED(hr))
    {
        return false;
    }

    D3DPRESENT_PARAMETERS desc;
    hr = spSwapChain->GetPresentParameters(&desc);
    if (FAILED(hr))
    {
        return false;
    }

    d3dformat_ = desc.BackBufferFormat;
    targetWidth_ = desc.BackBufferWidth;
    targetHeight_ = desc.BackBufferHeight;
    windowed_ = !!desc.Windowed;
    device_ = device;
    return true;
}

bool D3d9Graphics::_initSpriteDrawer()
{
    HRESULT hr = D3DX9Api::D3DXCreateSprite(session::loadD3dx9(), device_, spriteDrawer_.resetAndGetPointerAddress());
    if (FAILED(hr))
    {
        LOGGER("n_overlay") << L"D3DXCreateSprite failed" << hr;
        return false;
    }

    return true;
}

bool D3d9Graphics::_createSprites()
{
    HRESULT  hr = device_->CreateTexture(targetWidth_, targetHeight_, 1, D3DUSAGE_DYNAMIC, D3DFMT_A8R8G8B8, D3DPOOL_DEFAULT, blockSprite_.resetAndGetPointerAddress(), NULL);
    if (FAILED(hr))
    {
        LOGGER("n_overlay") << L"CreateTexture failed" << hr;
        return false;
    }
    D3DSURFACE_DESC desc;
    blockSprite_->GetLevelDesc(0, &desc);

    D3DLOCKED_RECT rc;
    blockSprite_->LockRect(0, &rc, 0, D3DLOCK_DISCARD);
    int* bytePointer = (int*)rc.pBits;

    memset(bytePointer, 0xff, rc.Pitch * desc.Height);

    blockSprite_->UnlockRect(0);

    return true;
}

void D3d9Graphics::_createWindowSprites()
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

Windows::ComPtr<IDirect3DTexture9> D3d9Graphics::_createDynamicTexture(std::uint32_t width, std::uint32_t height)
{
    Windows::ComPtr<IDirect3DTexture9> texture;
    HRESULT hr = device_->CreateTexture(width, height, 1, D3DUSAGE_DYNAMIC, D3DFMT_A8R8G8B8, D3DPOOL_DEFAULT, texture.resetAndGetPointerAddress(), NULL);
    if (FAILED(hr))
    {
        LOGGER("n_overlay") << L"CreateTexture, failed:" << hr;
        return nullptr;
    }

    return texture;
}

std::shared_ptr<CommonWindowSprite > D3d9Graphics::_createWindowSprite(const std::shared_ptr<overlay::Window>& window)
{
    std::shared_ptr<CommonWindowSprite> commonWindowSprite = __super::_createWindowSprite(window);
    std::shared_ptr<D3d9WindowSprite> windowSprite = std::dynamic_pointer_cast<D3d9WindowSprite>(commonWindowSprite);

    windowSprite->texture = _createDynamicTexture(window->rect.width, window->rect.height);
    if (!windowSprite->texture)
    {
        return nullptr;
    }


    _updateSprite(windowSprite);
    return windowSprite;
}

void D3d9Graphics::_updateSprite(std::shared_ptr<CommonWindowSprite>& commonWindowSprite, bool clear /*= false*/)
{
    std::shared_ptr<D3d9WindowSprite> windowSprite = std::dynamic_pointer_cast<D3d9WindowSprite>(commonWindowSprite);
    D3DSURFACE_DESC desc;
    HRESULT hr = windowSprite->texture->GetLevelDesc(0, &desc);
    if (FAILED(hr))
    {
        LOGGER("n_overlay") << L"GetLevelDesc, failed:" << hr;
        return;
    }

    D3DLOCKED_RECT rc;
    hr = windowSprite->texture->LockRect(0, &rc, 0, D3DLOCK_DISCARD);
    if (FAILED(hr))
    {
        LOGGER("n_overlay") << L"LockRect, failed:" << hr;
        return;
    }

    int* bytePointer = (int*)rc.pBits;

    if (clear)
    {
        memset(bytePointer, 0, sizeof(int) * desc.Width * desc.Height);
    }

    HookApp::instance()->overlayConnector()->lockShareMem();

    char *orgin = static_cast<char*>(windowSprite->windowBitmapMem->get_address());
    if (orgin)
    {
        overlay::ShareMemFrameBuffer* head = (overlay::ShareMemFrameBuffer*)orgin;
        int width = std::min(windowSprite->rect.width, head->width);
        int height = std::min(windowSprite->rect.height, head->height);

        std::uint32_t* mem = (std::uint32_t*)(orgin + sizeof(overlay::ShareMemFrameBuffer));

        int spriteWidth = rc.Pitch / sizeof(int);

        for (int i = 0; i != height; ++i)
        {
            const std::uint32_t* line = mem + i * head->width;
            int xx = i * spriteWidth;
            memcpy((bytePointer + xx), line, sizeof(int) * width);
        }
    }
    HookApp::instance()->overlayConnector()->unlockShareMem();

    windowSprite->texture->UnlockRect(0);
}
void D3d9Graphics::_syncPendingBounds(std::map<std::uint32_t, overlay::WindowRect> pendingBounds_) {
    for (const auto& [windowId, rect] : pendingBounds_)
    {
        auto it = std::find_if(windowSprites_.begin(), windowSprites_.end(), [windowId](const auto& window) {
            return windowId == window->windowId;
        });
        if (it != windowSprites_.end())
        {
            auto& windowSpriteBase = *it;
            std::shared_ptr<D3d9WindowSprite> windowSprite = std::dynamic_pointer_cast<D3d9WindowSprite>(windowSpriteBase);

            windowSprite->rect = rect;

            D3DSURFACE_DESC desc = { };

            if (windowSprite->texture)
            {
                windowSprite->texture->GetLevelDesc(0, &desc);
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

void D3d9Graphics::_drawBlockSprite()
{
    RECT  drawRect = { 0, 0, (LONG)targetWidth_, (LONG)targetHeight_ };
    D3DXVECTOR3 pos(0, 0, 0);
    spriteDrawer_->Draw(blockSprite_, &drawRect, 0, &pos, 0x800c0c0c);
}

void D3d9Graphics::_drawWindowSprite(std::shared_ptr<CommonWindowSprite>& windowSpriteBase)
{
    std::shared_ptr<D3d9WindowSprite> windowSprite = std::dynamic_pointer_cast<D3d9WindowSprite>(windowSpriteBase);
    D3DXVECTOR3 pos((FLOAT)windowSprite->rect.x, (FLOAT)windowSprite->rect.y, 0);
    RECT  drawRect = { 0, 0, windowSprite->rect.width, windowSprite->rect.height };

    spriteDrawer_->Draw(windowSprite->texture, &drawRect, 0, &pos, 0xffffffff);
}
