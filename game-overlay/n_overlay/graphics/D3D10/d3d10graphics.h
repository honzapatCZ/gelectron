#pragma once

#include "..\DXGI\dxgigraphics.h"
#include "..\commongraphics.h"

struct D3d10WindowSprite : CommonWindowSprite{

    Windows::ComPtr<ID3D10Texture2D> texture;
};

class D3d10SpriteDrawer;

class D3d10Graphics : public DxgiGraphics
{
    std::unique_ptr<D3d10SpriteDrawer> sprite_;

    Windows::ComPtr<IDXGISwapChain> swap_;

    Windows::ComPtr<ID3D10Device> d3dDevice_;
    Windows::ComPtr<ID3D10RenderTargetView> renderTargetView_;

    std::uint32_t targetWidth_ = 0;
    std::uint32_t targetHeight_ = 0;
    DXGI_FORMAT dxgiformat_ = DXGI_FORMAT_UNKNOWN;
    bool isSRGB_ = false;

    Windows::ComPtr<ID3D10DepthStencilState> depthStencilState_;
    Windows::ComPtr<ID3D10BlendState> transparentBlendState_;
    Windows::ComPtr<ID3D10RasterizerState> rasterizeState_;

    Windows::ComPtr<ID3D10Texture2D> blockSprite_;

    struct Status
    {
        UINT view_port_nums;
        D3D10_VIEWPORT view_port[D3D10_VIEWPORT_AND_SCISSORRECT_OBJECT_COUNT_PER_PIPELINE];
        ID3D10InputLayout * input_layout;
        ID3D10VertexShader * vertex_shader;
        ID3D10PixelShader * pixel_shader;
        ID3D10ShaderResourceView * shader_view;

        ID3D10SamplerState* sampler_states;

        ID3D10Buffer * const_buffer;
        ID3D10Buffer * vertex;//���㻺��
        UINT vertex_stride;
        UINT vertex_offset;
        ID3D10DepthStencilState * depth_stencil_state;
        UINT stencil_ref;
        DWORD draw_style;//���Ƶ�Ԫ
        ID3D10BlendState * blend_state;
        float blen_factor[4];
        UINT blen_mask;
        ID3D10RenderTargetView * render_target;
        ID3D10DepthStencilView * depth_stencil;
        ID3D10RasterizerState *  rasterizer;
    };

    Status savedStatus_ = {0};

    std::vector<std::shared_ptr<D3d10WindowSprite>> windowSprites_;
public:
    D3d10Graphics();
    ~D3d10Graphics();

    Windows::ComPtr<IDXGISwapChain> swapChain() const override;
    void freeGraphics() override;

    bool _initGraphicsContext(IDXGISwapChain* swap) override;
    bool _initGraphicsState() override;
    void _initSpriteDrawer() override;

    bool _createSprites() override;
    void _createWindowSprites() override;

    Windows::ComPtr<ID3D10Texture2D> _createDynamicTexture(std::uint32_t width, std::uint32_t height);
    std::shared_ptr<CommonWindowSprite> _createWindowSprite(const std::shared_ptr<overlay::Window>& window) override;
    void _updateSprite(std::shared_ptr<D3d10WindowSprite>& sprite, bool clear = false);

    void _syncPendingBounds(std::map<std::uint32_t, overlay::WindowRect> pendingBounds_) override;

    void _drawBlockSprite() override;
    void _drawWindowSprites() override;
    void _drawWindowSprite(std::shared_ptr<D3d10WindowSprite>&);

    void _saveStatus() override;
    void _prepareStatus() override;
    void _restoreStatus() override;
};