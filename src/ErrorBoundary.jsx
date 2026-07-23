import { Component } from 'react'

// بدون این مؤلفه، هر خطای غیرمنتظره در رندر (مثلاً پاسخ نامعتبر از API)
// کل درخت React رو unmount می‌کنه و فقط پس‌زمینه‌ی تیره‌ی body می‌مونه —
// دقیقاً همون «صفحه یهو مشکی می‌شه» که کاربر گزارش کرده.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash-screen">
          <h2>یه مشکلی پیش اومد</h2>
          <p>صفحه با خطا مواجه شد. می‌تونی دوباره امتحان کنی.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            بارگذاری مجدد صفحه
          </button>
          <pre className="crash-details">{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
