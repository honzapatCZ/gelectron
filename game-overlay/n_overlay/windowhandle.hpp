#include <cstdint>
#include <windef.h>

class WindowHandle {
public:
	WindowHandle() noexcept = default;

	explicit WindowHandle(std::uint64_t _handle) noexcept {
		handle = _handle;
	}

	explicit WindowHandle(HWND _handle) noexcept {
		handle = reinterpret_cast<std::uint64_t>(_handle);
	}

	std::uint64_t getInt() const noexcept {
		return handle;
	}

	HWND getHandle() const noexcept {
		return reinterpret_cast<HWND>(handle);
	}

private:
	std::uint64_t handle = 0;
};

inline void to_json(nlohmann::json& j, const WindowHandle& p) {
	j = p.getInt();
}

inline void from_json(const nlohmann::json& j, WindowHandle& p) {
	p = WindowHandle(j.get<std::uint64_t>());
}