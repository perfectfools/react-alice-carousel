import React from 'react'
import Swipeable from 'react-swipeable'

import * as Utils from './utils'
import * as Views from './views'
import { propTypes, defaultProps } from './prop-types'

export default class AliceCarousel extends React.PureComponent {
  constructor(props) {
    super(props)
    this.state = {
      clones: [],
      stagePadding: {},
      currentIndex: 1,
      initialStageHeight: 0,
      duration: props.duration,
      slides: Utils.getSlides(props),
      style: Utils.getDefaultStyles(),
    }

    this.touchEventsCallstack = []
    this._onTouchMove = this._onTouchMove.bind(this)
    this._debouncedHandleOnWindowResize = Utils.debounce(this._handleOnWindowResize, 100)
  }

  componentDidMount() {
    this._setInitialState()
    this._resetAllIntermediateProps()

    window.addEventListener('resize', this._debouncedHandleOnWindowResize)

    if (!this.props.keysControlDisabled) {
      window.addEventListener('keyup', this._handleOnKeyUp)
    }

    this.deviceInfo = Utils.deviceInfo()
    this.props.autoPlay && this._play()
  }

  componentDidUpdate(prevProps) {
    if (this.props.autoHeight && this.stageComponent && !this.state.initialStageHeight) {
      const initialStageHeight = Utils.getGalleryItemHeight(this.stageComponent, this.props, this.state)
      this.setState({ initialStageHeight })
    }

    if (this.props.duration !== prevProps.duration) {
      this.setState({ duration: this.props.duration })
    }

    if (this.props.fadeOutAnimation !== prevProps.fadeOutAnimation) {
      this.setState({ fadeoutAnimationProcessing: false }, this._resetAnimationProps)
    }

    if (this.props.slideToIndex !== prevProps.slideToIndex) {
      this._onSlideToIndexChange(this.state.currentIndex, this.props.slideToIndex)
    }

    if (
      this.props.disableAutoPlayOnAction !== prevProps.disableAutoPlayOnAction ||
      this.props.autoPlayDirection !== prevProps.autoPlayDirection ||
      this.props.autoPlayInterval !== prevProps.autoPlayInterval ||
      this.props.infinite !== prevProps.infinite ||
      this.props.autoPlay !== prevProps.autoPlay
    ) {
      this.props.autoPlay ? this._play() : this._pause()
    }

    if (
      this.props.stagePadding !== prevProps.stagePadding ||
      this.props.responsive !== prevProps.responsive ||
      this.props.infinite !== prevProps.infinite ||
      this.props.items !== prevProps.items
    ) {
      this._resetAllIntermediateProps()
      this.setState(Utils.calculateInitialProps(this.props, this.stageComponent))
    }

    if (this.props.keysControlDisabled !== prevProps.keysControlDisabled) {
      this.props.keysControlDisabled
        ? window.removeEventListener('keyup', this._handleOnKeyUp)
        : window.addEventListener('keyup', this._handleOnKeyUp)
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this._debouncedHandleOnWindowResize)

    if (!this.props.keysControlDisabled) {
      window.removeEventListener('keyup', this._handleOnKeyUp)
    }

    if (this._autoPlayIntervalId) {
      clearInterval(this._autoPlayIntervalId)
      this._autoPlayIntervalId = null
    }
  }

  _handleOnWindowResize = () => {
    if (Utils.shouldCallHandlerOnWindowResize(this.deviceInfo)) {
      this.deviceInfo = Utils.deviceInfo()
      this._disableAnimation()
      this._handleOnMouseEnter()

      const isAnimationCanceled = this._isSwipeAnimationProcessing()
      const currState = Utils.calculateInitialProps(this.props, this.stageComponent)
      const translate3d = Utils.getTranslate3dPosition(currState.currentIndex, currState)
      const nextState = { ...currState, translate3d, isAnimationCanceled, initialStageHeight: 0 }

      if (isAnimationCanceled) Utils.animate(this.stageComponent, translate3d)

      this.setState(nextState, () => {
        this._resetAllIntermediateProps()
        this._handleOnMouseLeave()
        this._onResized()
      })
    }
  }

  _handleOnAnimationCanceled = () => {
    this._resetAllIntermediateProps()
    this.setState({ isAnimationCanceled: false })
  }

  _handleOnKeyUp = (e) => {
    switch (e.keyCode) {
      case 32:
        return this._handleOnSpaceBarClick()
      case 37:
        return this._slidePrev()
      case 39:
        return this._slideNext()
    }
  }

  _handleOnSpaceBarClick = () => {
    this.props.autoPlay && this._playPauseToggle()
  }

  _handleOnMouseEnter = () => {
    if (this.props.stopAutoPlayOnHover) {
      this.isHovered = true
    }
  }

  _handleOnMouseLeave = () => {
    this.isHovered = false
  }

  _onSlideToIndexChange = (currentIndex, slideToIndex) => {
    if (slideToIndex === currentIndex + 1) {
      this._slideNext()
    } else if (slideToIndex === currentIndex - 1) {
      this._slidePrev()
    } else {
      this._onDotClick(slideToIndex)
    }
  }

  _onInactiveItem = () => {
    this._onSlideChange()
    this._onSlideChanged()
    this._allowAnimation()
    this._pause()
  }

  _onSlideChange() {
    if (this.props.onSlideChange) {
      this.props.onSlideChange(this._getEventObject())
    }
  }

  _onSlideChanged() {
    if (this.props.onSlideChanged) {
      this.props.onSlideChanged(this._getEventObject())
    }
    this._allowAnimation()
  }

  _onInitialized(initialState) {
    if (this.props.onInitialized) {
      this.props.onInitialized(this._getEventObject(initialState))
    }
  }

  _onResized() {
    if (this.props.onResized) {
      this.props.onResized(this._getEventObject())
    }
  }

  _onDotClick = (itemIndex) => {
    if (this._isClickDisabled(itemIndex)) return

    this._disableAnimation()
    this._isFadeOutAnimationAllowed() && this.setAnimationPropsOnDotClick(itemIndex)
    this.props.disableAutoPlayOnAction && this._pause()
    this._slideToItem(itemIndex)
  }

  _setInitialState() {
    const initialState = Utils.calculateInitialProps(this.props, this.stageComponent)
    this.setState(initialState, this._onInitialized(initialState))
  }

  _getFadeOutAnimationState = (shouldRecalculate) => {
    if (shouldRecalculate || this._isFadeOutAnimationAllowed()) {
      return { fadeoutAnimationProcessing: false }
    }
    return {}
  }

  _getStageComponentNode = (node) => {
    return (this.stageComponent = node)
  }

  _allowAnimation = () => {
    return (this.allowAnimation = true)
  }

  _disableAnimation = () => {
    return (this.allowAnimation = false)
  }

  _checkSlidePosition(shouldSkipRecalculation) {
    this._stopSwipeAnimation()
    this._resetAnimationProps()
    this._resetSwipePositionProps()

    shouldSkipRecalculation ? this._skipSlidePositionRecalculation() : this._updateSlidePosition()
  }

  _skipSlidePositionRecalculation = () => {
    if (this._isFadeOutAnimationAllowed()) {
      return this._resetFadeOutAnimationState()
    }

    this._onSlideChanged()
    this.props.disableAutoPlayOnAction && this._pause()
    this.isHovered = false
  }

  _updateSlidePosition = () => {
    this._updateSlidePositionIntervalId = setTimeout(() => {
      if (this._shouldRecalculatePosition()) {
        this._recalculateSlidePosition()
      } else if (this._isFadeOutAnimationAllowed()) {
        this._resetFadeOutAnimationState()
      } else {
        this._onSlideChanged()
      }
    }, this.state.duration)
  }

  _resetFadeOutAnimationState = () => {
    this.setState({ fadeoutAnimationProcessing: false }, this._onSlideChanged)
  }

  _resetAllIntermediateProps = () => {
    this.swipingStarted = false
    this.verticalSwipingDetected = false

    this._stopSwipeAnimation()
    this._resetAnimationProps()
    this._resetSwipePositionProps()
    this._clearUpdateSlidePositionIntervalId()
    this._resetTranslateAnimationProcessingFlag()
    this._allowAnimation()
  }

  _recalculateSlidePosition = () => {
    const style = Utils.getDefaultStyles()
    const currentIndex = Utils.recalculateCurrentSlideIndex(this.state)
    const translate3d = Utils.recalculateTranslatePosition(this.state)

    this.setState(
      {
        currentIndex,
        translate3d,
        style,
        ...this._getFadeOutAnimationState(),
      },
      () => this._onSlideChanged(),
    )
  }

  _getEventObject = (state = this.state) => {
    const { items: itemsInSlide, currentIndex: item } = state
    const { isNextSlideDisabled } = Utils.itemInfo(state)
    const slide = Utils.getActiveSlideIndex(isNextSlideDisabled, state)

    return { item, slide, itemsInSlide }
  }

  setAnimationPropsOnDotClick = (itemIndex) => {
    const { currentIndex, itemWidth } = this.state
    const fadeOutIndex = currentIndex + 1
    const fadeOutOffset = Utils.getFadeOutOffsetOnDotClick(itemIndex, currentIndex, itemWidth)

    this._setAnimationProps({ fadeOutIndex, fadeOutOffset, allowFadeOutAnimation: true })
  }

  _setAutoPlayInterval() {
    const { duration } = this.state
    const { autoPlayDirection, autoPlayInterval } = this.props
    const playInterval = Math.max(autoPlayInterval, duration)

    this._autoPlayIntervalId = setInterval(() => {
      if (!this._isHovered() && this._autoPlayIntervalId && this.state.isPlaying) {
        autoPlayDirection === 'rtl' ? this._slidePrev(false) : this._slideNext(false)
      }
    }, playInterval)
  }

  _clearAutoPlayInterval() {
    clearInterval(this._autoPlayIntervalId)
    this._autoPlayIntervalId = null
  }

  _clearUpdateSlidePositionIntervalId() {
    clearInterval(this._updateSlidePositionIntervalId)
  }

  _play() {
    this.setState({ isPlaying: true })
    if (!this._autoPlayIntervalId) {
      this._setAutoPlayInterval()
    }
  }

  _pause = () => {
    if (this._autoPlayIntervalId) {
      this._clearAutoPlayInterval()
      this.setState({ isPlaying: false })
    }
  }

  _playPauseToggle = () => {
    if (!this.allowAnimation) return
    this.state.isPlaying ? this._pause() : this._play()
  }

  _getIntermediateStateProps = (duration, shouldSkipRecalculation) => {
    const condition = !shouldSkipRecalculation && this._isFadeOutAnimationAllowed()
    return Utils.getIntermediateTransitionProps(condition, duration)
  }

  _slideToItem(index, options = {}) {
    this._onSlideChange()
    const { duration = this.state.duration, shouldSkipRecalculation = false } = options
    const translate3d = Utils.getTranslate3dPosition(index, this.state)

    this.setState(
      {
        currentIndex: index,
        translate3d,
        ...this._getIntermediateStateProps(duration, shouldSkipRecalculation),
      },
      () => this._checkSlidePosition(shouldSkipRecalculation),
    )
  }

  _addTouchEventToCallstack = () => {
    this.touchEventsCallstack.push(1)
  }

  _removeTouchEventFromCallstack = () => {
    this.touchEventsCallstack.pop()
  }

  _setTranslateAnimationProcessingFlag = () => {
    this.translateAnimationProcessing = true
  }

  _resetTranslateAnimationProcessingFlag = () => {
    this.translateAnimationProcessing = false
  }

  _startSwipeAnimation = () => {
    this.swipeAnimation = true
  }

  _stopSwipeAnimation = () => {
    this.swipeAnimation = false
  }

  _setAnimationProps = (newProps) => {
    let prevProps = this.animationProps || {}
    this.animationProps = { ...prevProps, ...newProps }
  }

  _resetAnimationProps = () => {
    this.animationProps = {}
  }

  _setSwipePositionProps = (newProps) => {
    const prevProps = this.swipePosition || {}
    this.swipePosition = { ...prevProps, ...newProps }
  }

  _resetSwipePositionProps = () => {
    this.swipePosition = {}
  }

  _getTranslateXPosition = (deltaX) => {
    const { translate3d } = this.state
    const { startPosition = translate3d } = this.swipePosition

    if (!!this.touchEventsCallstack.length && this.translateAnimationProcessing) {
      this._resetTranslateAnimationProcessingFlag()
      const lastTranslateXPosition = Utils.getTranslateX(this.stageComponent)

      if (lastTranslateXPosition) {
        return lastTranslateXPosition - deltaX
      }
    }
    return startPosition - deltaX
  }

  _onTouchMove(e, deltaX, deltaY) {
    this.swipingStarted = true
    this._handleOnMouseEnter()

    if (Utils.isVerticalTouchMoveDetected(e, deltaX, deltaY)) {
      this.verticalSwipingDetected = true
      return
    } else {
      this.verticalSwipingDetected = false
    }

    if (this._isSwipeDisable()) {
      return
    }

    this._disableAnimation()
    this._startSwipeAnimation()
    this._clearUpdateSlidePositionIntervalId()

    const { slides, items, itemWidth, infinite, stagePadding } = this.state
    const slidesLength = slides.length
    const direction = Utils.getSwipeDirection(deltaX)
    let position = this._getTranslateXPosition(deltaX)

    if (infinite === false) {
      const minSwipeLimit = Utils.getMinSwipeLimitIfNotInfinite(items, itemWidth)
      const maxSwipeLimit = Utils.getMaxSwipeLimitIfNotInfinite(slidesLength, itemWidth)

      if (Utils.shouldRecalculateSwipePosition(position, minSwipeLimit, maxSwipeLimit)) {
        return
      }

      Utils.animate(this.stageComponent, position)
      this._setSwipePositionProps({ position, direction })
      return
    }

    const maxPosition = Utils.getMaxSwipePosition(items, itemWidth, slidesLength)
    const minPosition = Utils.getMinSwipePosition(items, itemWidth)
    const maxSwipeLimit = Utils.getMaxSwipeLimit(maxPosition, stagePadding)
    const minSwipeLimit = Utils.getMinSwipeLimit(minPosition, stagePadding)

    if (Utils.shouldRecalculateSwipePosition(position, minSwipeLimit, maxSwipeLimit)) {
      try {
        recalculatePosition()
      } catch (err) {
        Utils.debug(err)
      }
    }

    Utils.animate(this.stageComponent, position)
    this._setSwipePositionProps({ position, direction })

    function recalculatePosition() {
      direction === 'RIGHT'
        ? (position = position + slidesLength * -itemWidth)
        : (position = position + maxPosition - items * itemWidth)

      if (Utils.shouldRecalculateSwipePosition(position, minSwipeLimit, maxSwipeLimit)) {
        recalculatePosition()
      }
    }
  }

  _onTouchEnd = () => {
    this.swipingStarted = false

    if (this._isSwipeDisable()) {
      return
    }

    this._addTouchEventToCallstack()
    this._setSwipePositionProps({ startPosition: this.swipePosition.position })
    this._beforeTouchEnd()
  }

  _beforeTouchEnd() {
    const { direction, position } = this.swipePosition
    const { itemWidth, items, duration, infinite } = this.state
    const swipeIndex = Utils.calculateSwipeIndex(itemWidth, position, direction)
    const currentIndex = Utils.getSwipeIndexOnBeforeTouchEnd(swipeIndex, items)
    const translateXPosition = Utils.getSwipePositionOnBeforeTouchEnd(swipeIndex, itemWidth)

    if (infinite === false) {
      this._isInfiniteModeDisabledBeforeTouchEnd(swipeIndex, currentIndex)
      return
    }

    this._setTranslateAnimationProcessingFlag()
    Utils.animate(this.stageComponent, translateXPosition, duration)

    setTimeout(() => {
      this._removeTouchEventFromCallstack()
      this._resetTranslateAnimationProcessingFlag()

      if (this._isSwipeAnimationLastFrame()) {
        if (this.state.isAnimationCanceled) {
          return this._handleOnAnimationCanceled()
        }

        const nextItemIndex = Utils.getNextItemIndexBeforeTouchEnd(translateXPosition, this.state)
        const nextTranslateXPosition = Utils.getTranslate3dPosition(nextItemIndex, this.state)

        Utils.animate(this.stageComponent, nextTranslateXPosition, 0)
        this._slideToItem(nextItemIndex, { duration: 0, shouldSkipRecalculation: true })
      }
    }, duration)
  }

  _isInfiniteModeDisabledBeforeTouchEnd(swipeIndex, currentIndex) {
    const { items, itemWidth, duration, slides } = this.state
    let position = Utils.getTranslate3dPosition(currentIndex, { itemWidth, items })

    if (swipeIndex < items) {
      currentIndex = Utils.recalculateCurrentIndexOnBeforeTouchEnd()
      position = Utils.recalculatePositionOnBeforeTouchEnd(items, itemWidth)
    }

    if (swipeIndex > slides.length) {
      currentIndex = Utils.recalculateCurrentIndexOnBeforeTouchEnd(slides.length, items)
      position = Utils.recalculatePositionOnBeforeTouchEnd(slides.length, itemWidth)
    }

    Utils.animate(this.stageComponent, position, duration)
    this._setTranslateAnimationProcessingFlag()

    setTimeout(() => {
      this._removeTouchEventFromCallstack()
      this._resetTranslateAnimationProcessingFlag()

      if (this._isSwipeAnimationLastFrame()) {
        if (this.state.isAnimationCanceled) {
          return this._handleOnAnimationCanceled()
        }

        Utils.animate(this.stageComponent, position)
        this._slideToItem(currentIndex, { duration: 0, shouldSkipRecalculation: true })
      }
    }, duration)
  }

  _isHovered = () => {
    return this.isHovered
  }

  _isClickDisabled = (itemIndex) => {
    const { currentIndex, isAnimationCanceled } = this.state
    return currentIndex === itemIndex || isAnimationCanceled || !this.allowAnimation || this.swipeAnimation
  }

  _isFadeOutAnimationAllowed = () => {
    const { stagePadding, items } = this.state
    const hasNoStagePadding = !(stagePadding.paddingLeft || stagePadding.paddingRight)

    return this.props.fadeOutAnimation && items === 1 && hasNoStagePadding
  }

  _isSwipeDisable = () => {
    const { isAnimationCanceled, fadeOutAnimation } = this.state
    return this.props.swipeDisabled || fadeOutAnimation || isAnimationCanceled || this.verticalSwipingDetected
  }

  _isSwipeAnimationLastFrame = () => {
    return !this.swipingStarted && this.touchEventsCallstack.length === 0
  }

  _isSwipeAnimationProcessing = () => {
    return !!this.touchEventsCallstack.length
  }

  _shouldRecalculatePosition = () => {
    const { slides, currentIndex } = this.state
    return currentIndex < 0 || currentIndex >= slides.length
  }

  _setAnimationPropsOnClick = (direction) => {
    const { currentIndex, itemWidth } = this.state
    const fadeOutIndex = Utils.getFadeOutIndexOnClick(currentIndex)
    const fadeOutOffset = Utils.getFadeOutOffsetOnClick(direction, itemWidth)

    this._setAnimationProps({ fadeOutIndex, fadeOutOffset, allowFadeOutAnimation: true })
  }

  _slidePrev = (action = true) => {
    if (this._isClickDisabled()) return

    this._disableAnimation()
    this._isFadeOutAnimationAllowed() && this._setAnimationPropsOnClick('prev')

    if (Utils.itemInfo(this.state).isPrevSlideDisabled) return this._onInactiveItem()
    if (action && this.props.disableAutoPlayOnAction) this._pause()

    this._slideToItem(this.state.currentIndex - 1)
  }

  _slideNext = (action = true) => {
    if (this._isClickDisabled()) return

    this._disableAnimation()
    this._isFadeOutAnimationAllowed() && this._setAnimationPropsOnClick('next')

    if (Utils.itemInfo(this.state).isNextSlideDisabled) return this._onInactiveItem()
    if (action && this.props.disableAutoPlayOnAction) this._pause()

    this._slideToItem(this.state.currentIndex + 1)
  }

  _renderSlideInfo = () => {
    const { currentIndex, slides } = this.state
    return <Views.SlideInfo slidesLength={slides.length} currentIndex={currentIndex} />
  }

  _renderPrevButton() {
    const { isPrevSlideDisabled } = Utils.itemInfo(this.state)
    return (
      <Views.PrevNextButton
        name="prev"
        disabled={isPrevSlideDisabled}
        onClick={this._slidePrev}
        onMouseEnter={this._handleOnMouseEnter}
        onMouseLeave={this._handleOnMouseLeave}
      />
    )
  }

  _renderNextButton() {
    const { isNextSlideDisabled } = Utils.itemInfo(this.state)
    return (
      <Views.PrevNextButton
        name="next"
        disabled={isNextSlideDisabled}
        onClick={this._slideNext}
        onMouseEnter={this._handleOnMouseEnter}
        onMouseLeave={this._handleOnMouseLeave}
      />
    )
  }

  _renderStageItem = (item, i) => {
    const style = Utils.itemStyles(i, this.state, this.animationProps)
    const className = Utils.itemClassName(i, this.state, this.animationProps)
    return <Views.StageItem styles={style} className={className} key={`stage-item-${i}`} item={item} />
  }

  _renderPlayPauseButton() {
    return <Views.PlayPauseButton isPlaying={this.state.isPlaying} onClick={this._playPauseToggle} />
  }

  _renderDotsNavigation() {
    return (
      <Views.DotsNavigation
        state={this.state}
        onClick={this._onDotClick}
        onMouseEnter={this._handleOnMouseEnter}
        onMouseLeave={this._handleOnMouseLeave}
      />
    )
  }

  render() {
    const { style, translate3d, clones } = this.state
    const wrapperStyles = Utils.getWrapperStyles(this.stageComponent, this.props, this.state)
    const stageStyles = Utils.getStageStyles({ translate3d }, style)

    return (
      <div className="alice-carousel">
        <Swipeable
          rotationAngle={3}
          stopPropagation={true}
          onSwiping={this._onTouchMove}
          onSwiped={this._onTouchEnd}
          trackMouse={this.props.mouseDragEnabled}
          preventDefaultTouchmoveEvent={this.props.preventEventOnTouchMove}
        >
          <div
            style={wrapperStyles}
            className="alice-carousel__wrapper"
            onMouseEnter={this._handleOnMouseEnter}
            onMouseLeave={this._handleOnMouseLeave}
          >
            <ul style={stageStyles} className="alice-carousel__stage" ref={this._getStageComponentNode}>
              {clones.map(this._renderStageItem)}
            </ul>
          </div>
        </Swipeable>

        {this.props.showSlideInfo ? this._renderSlideInfo() : null}
        {!this.props.dotsDisabled ? this._renderDotsNavigation() : null}
        {!this.props.buttonsDisabled ? this._renderPrevButton() : null}
        {!this.props.buttonsDisabled ? this._renderNextButton() : null}
        {this.props.playButtonEnabled ? this._renderPlayPauseButton() : null}
      </div>
    )
  }
}

AliceCarousel.propTypes = propTypes
AliceCarousel.defaultProps = defaultProps
